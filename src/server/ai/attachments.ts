import type {
  AiAttachmentInput,
  AiAttachmentKind,
  AiContentPart,
  AiModel,
} from './types.ts';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_NAME_LENGTH,
  MAX_TEXT_CHARS,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from './attachment-constants.ts';

/**
 * Upload limits are deliberately below the platform request-body limit. The
 * browser base64-encodes files, which adds roughly 33%, so keeping the raw
 * payload near 3 MB leaves room for the JSON envelope on Vercel Functions.
 */
export {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  MAX_TEXT_CHARS,
} from './attachment-constants.ts';

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'text/csv',
  'application/json',
]);

const PDF_TYPE = 'application/pdf';

export interface ValidatedAttachment extends AiAttachmentInput {
  kind: AiAttachmentKind;
  /** Decoded byte length. */
  size: number;
}

export type AttachmentValidationResult =
  | { ok: true; attachments: ValidatedAttachment[] }
  | { ok: false; message: string };

export function classifyMimeType(mimeType: string): AiAttachmentKind | null {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  if (IMAGE_TYPES.has(normalized)) return 'image';
  if (normalized === PDF_TYPE) return 'pdf';
  if (TEXT_TYPES.has(normalized)) return 'text';
  return null;
}

function normalizeBase64(value: string): string {
  const withoutPrefix = value.replace(/^data:[^;,]*;base64,/i, '');
  return withoutPrefix.replace(/\s+/g, '');
}

function decodedBase64Length(value: string): number {
  if (!value) return 0;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_ATTACHMENT_NAME_LENGTH);
}

/**
 * Validate untrusted attachments from the chat request. Rejects unsupported
 * MIME types, malformed base64, oversized files, and excessive counts.
 */
export function validateAttachments(raw: unknown): AttachmentValidationResult {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'صيغة المرفقات غير صالحة.' };
  }
  if (raw.length > MAX_ATTACHMENTS) {
    return { ok: false, message: `الحد الأقصى ${MAX_ATTACHMENTS} مرفقات في الرسالة الواحدة.` };
  }

  const attachments: ValidatedAttachment[] = [];
  let totalBytes = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index] as Partial<AiAttachmentInput> | null;
    if (!item || typeof item !== 'object') {
      return { ok: false, message: 'أحد المرفقات غير صالح.' };
    }

    const mimeType =
      typeof item.mimeType === 'string'
        ? item.mimeType.split(';')[0].trim().toLowerCase()
        : '';
    const kind = classifyMimeType(mimeType);
    if (!kind) {
      return {
        ok: false,
        message: 'نوع الملف غير مدعوم. المسموح: صور PNG/JPG/WEBP/GIF، ملفات PDF، وملفات نصية.',
      };
    }

    const data = typeof item.data === 'string' ? normalizeBase64(item.data) : '';
    if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { ok: false, message: `بيانات الملف رقم ${index + 1} غير صالحة.` };
    }

    const size = decodedBase64Length(data);
    if (size <= 0) {
      return { ok: false, message: `الملف رقم ${index + 1} فارغ.` };
    }
    if (size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        message: `حجم الملف "${sanitizeName(item.name) || index + 1}" أكبر من 2.5 ميجابايت.`,
      };
    }

    totalBytes += size;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return { ok: false, message: 'إجمالي حجم المرفقات أكبر من 3 ميجابايت.' };
    }

    attachments.push({
      name: sanitizeName(item.name) || `attachment-${index + 1}`,
      mimeType,
      data,
      kind,
      size,
    });
  }

  return { ok: true, attachments };
}

/** Return an Arabic explanation when the selected model cannot read a file. */
export function modelAttachmentError(
  model: AiModel,
  attachments: ValidatedAttachment[],
): string | null {
  if (attachments.some((a) => a.kind === 'image') && !model.capabilities.supportsVision) {
    return 'النموذج الحالي لا يدعم تحليل الصور. اختر نموذجًا يدعم الرؤية مثل Gemini أو GPT-6 أو Claude Opus.';
  }
  if (attachments.some((a) => a.kind === 'pdf') && !model.capabilities.supportsFiles) {
    return 'النموذج الحالي لا يدعم قراءة PDF مباشرة. اختر نموذجًا آخر يدعم الملفات.';
  }
  return null;
}

function decodeTextAttachment(attachment: ValidatedAttachment): string {
  const text = Buffer.from(attachment.data, 'base64').toString('utf8');
  const cleaned = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  if (cleaned.length <= MAX_TEXT_CHARS) return cleaned;
  return `${cleaned.slice(0, MAX_TEXT_CHARS)}\n\n[... تم اقتطاع بقية الملف لأن حجمه النصي كبير ...]`;
}

/**
 * Build the content parts for the latest user turn: the typed prompt plus one
 * part per attachment. Images use data URLs, PDFs use native file parts, and
 * plain text files are inlined as readable text.
 */
export function buildUserContent(
  prompt: string,
  attachments: ValidatedAttachment[],
): AiContentPart[] {
  const parts: AiContentPart[] = [];
  const trimmed = prompt.trim();
  if (trimmed) {
    parts.push({ type: 'text', text: trimmed });
  } else if (attachments.length > 0) {
    parts.push({
      type: 'text',
      text: 'حلّل المرفقات وأعطني ملخصًا مفيدًا وخطوات عملية للاستفادة منها في الخدمة.',
    });
  }

  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      parts.push({
        type: 'image',
        mimeType: attachment.mimeType,
        data: attachment.data,
      });
    } else if (attachment.kind === 'pdf') {
      parts.push({
        type: 'file',
        mimeType: attachment.mimeType,
        filename: attachment.name,
        data: attachment.data,
      });
    } else {
      parts.push({
        type: 'text',
        text: `\n\n--- ملف نصي مرفق: ${attachment.name} ---\n${decodeTextAttachment(attachment)}`,
      });
    }
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', text: 'حلّل المرفقات وأعطني ملخصًا مفيدًا.' });
  }

  return parts;
}

/** Human-readable summary stored with the conversation for later turns. */
export function attachmentSummary(attachments: ValidatedAttachment[]): string {
  return attachments
    .map((a) => `[${a.kind === 'image' ? 'صورة' : a.kind === 'pdf' ? 'PDF' : 'ملف نصي'}: ${a.name}]`)
    .join(' ');
}
