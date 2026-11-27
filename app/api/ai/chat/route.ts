import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  getAccessContext,
  jsonResponse,
  unauthorized,
  badRequest,
  serverError,
} from '@/src/server/middleware';
import { aiService } from '@/src/server/ai/service';
import { getModelById } from '@/src/server/ai/registry';
import { buildAiDataContext } from '@/src/server/ai/context';
import {
  buildUserContent,
  modelAttachmentError,
  validateAttachments,
} from '@/src/server/ai/attachments';
import type { ChatMessage } from '@/src/server/ai/types';
import { buildSystemPrompt } from '@/src/server/ai/system-prompt';
import { getRequestIp, rateLimit, rateLimitedResponse } from '@/src/server/security';

const MAX_HISTORY_MESSAGES = 40;

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        Boolean(part) &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string',
    )
    .map((part) => part.text)
    .join('\n');
}

async function handler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    // Protect the paid upstream gateway: per-user burst and hourly caps.
    const burst = rateLimit(`ai:burst:${auth.sub}`, 6, 60);
    if (!burst.allowed) return rateLimitedResponse(burst.retryAfterSeconds);
    const hourly = rateLimit(`ai:hour:${auth.sub}`, 60, 60 * 60);
    if (!hourly.allowed) return rateLimitedResponse(hourly.retryAfterSeconds);
    const ipLimit = rateLimit(`ai:ip:${getRequestIp(req)}`, 120, 60 * 60);
    if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfterSeconds);

    const body = await req.json();
    const { modelId, messages, stream = true } = body;

    if (!modelId || typeof modelId !== 'string') {
      return badRequest('معرف النموذج (modelId) مطلوب.', 'MODEL_REQUIRED');
    }

    const model = getModelById(modelId);
    if (!model || model.status !== 'live') {
      return badRequest('النموذج المحدد غير موجود أو غير متاح حاليًا.', 'MODEL_UNAVAILABLE');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return badRequest('قائمة الرسائل (messages) مطلوبة ولا يمكن أن تكون فارغة.', 'MESSAGES_REQUIRED');
    }
    if (messages.length > MAX_HISTORY_MESSAGES) {
      return badRequest('المحادثة طويلة جدًا. ابدأ محادثة جديدة للمتابعة.', 'HISTORY_TOO_LONG');
    }

    // Client-supplied system messages are discarded: the server owns the
    // instructions and the scoped data snapshot.
    const sanitizedMessages: ChatMessage[] = [];
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue;
      const role = m.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const content = textContent(m.content);
      if (!content.trim()) continue;
      sanitizedMessages.push({ role, content });
    }

    if (sanitizedMessages.length === 0) {
      return badRequest('الرسائل غير صالحة.', 'MESSAGES_INVALID');
    }

    const validation = validateAttachments(body.attachments);
    if (!validation.ok) {
      return badRequest(validation.message, 'INVALID_ATTACHMENT');
    }

    const attachmentError = modelAttachmentError(model, validation.attachments);
    if (attachmentError) {
      return badRequest(attachmentError, 'MODEL_ATTACHMENT_UNSUPPORTED');
    }

    if (validation.attachments.length > 0) {
      const lastUserIndex = sanitizedMessages.map((m) => m.role).lastIndexOf('user');
      if (lastUserIndex < 0) {
        return badRequest('لا يمكن إرفاق ملف دون رسالة نصية من المستخدم.', 'ATTACHMENT_WITHOUT_MESSAGE');
      }
      const last = sanitizedMessages[lastUserIndex];
      const currentText = typeof last.content === 'string' ? last.content : '';
      sanitizedMessages[lastUserIndex] = {
        ...last,
        content: buildUserContent(currentText, validation.attachments),
      };
    }

    let dataContext: string;
    try {
      const access = await getAccessContext(auth);
      dataContext = await buildAiDataContext(access);
    } catch {
      dataContext =
        '## بيانات الكنيسة المتاحة لك الآن\n- تعذر تحميل بيانات الكنيسة مؤقتًا. أجب عن الأسئلة العامة فقط، ووضّح للمستخدم أن الاستعلام عن البيانات غير متاح الآن.';
    }

    sanitizedMessages.unshift({ role: 'system', content: buildSystemPrompt(dataContext) });

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            await aiService.streamChat(
              {
                modelId,
                messages: sanitizedMessages,
              },
              (chunk) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              },
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (err) {
            // Never forward upstream error text (it can name providers or keys).
            console.error('[ai/chat] stream failed:', err instanceof Error ? err.name : 'UnknownError');
            const errorMsg = 'تعذر الحصول على رد الآن. حاول مرة أخرى بعد قليل.';
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`),
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = await aiService.chat({
      modelId,
      messages: sanitizedMessages,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error('[ai/chat] request failed:', error instanceof Error ? error.name : 'UnknownError');
    return serverError('تعذر إتمام طلب الذكاء الاصطناعي. حاول مرة أخرى بعد قليل.');
  }
}

export const POST = withTenant(handler);
