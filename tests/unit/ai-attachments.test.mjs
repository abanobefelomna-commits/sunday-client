import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ATTACHMENTS,
  buildUserContent,
  classifyMimeType,
  modelAttachmentError,
  validateAttachments,
} from '../../src/server/ai/attachments.ts';
import { getModelById } from '../../src/server/ai/registry.ts';
import { SovereignEGAdapter } from '../../src/server/ai/adapters/sovereigneg-adapter.ts';

// Smallest valid PNG (1x1, red).
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8').toString('base64');

function attachment(mimeType, data, name = 'file') {
  return { name, mimeType, data };
}

test('attachment validation accepts images, PDFs, and text files', () => {
  const result = validateAttachments([
    attachment('image/png', PNG_BASE64, 'photo.png'),
    attachment('application/pdf', PDF_BASE64, 'lesson.pdf'),
    attachment('text/plain', Buffer.from('نص الدرس', 'utf8').toString('base64'), 'lesson.txt'),
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.attachments.length, 3);
  assert.deepEqual(
    result.attachments.map((item) => item.kind),
    ['image', 'pdf', 'text'],
  );
  assert.ok(result.attachments.every((item) => item.size > 0));
});

test('attachment validation rejects unsupported, malformed, and excessive input', () => {
  const unsupported = validateAttachments([attachment('application/zip', PNG_BASE64)]);
  assert.equal(unsupported.ok, false);

  const malformed = validateAttachments([attachment('image/png', 'not base64!')]);
  assert.equal(malformed.ok, false);

  const empty = validateAttachments([attachment('image/png', '')]);
  assert.equal(empty.ok, false);

  const tooMany = validateAttachments(
    Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) =>
      attachment('image/png', PNG_BASE64, `photo-${index}.png`),
    ),
  );
  assert.equal(tooMany.ok, false);

  const notArray = validateAttachments({ name: 'photo.png' });
  assert.equal(notArray.ok, false);
});

test('attachment validation strips data URL prefixes and normalizes names', () => {
  const result = validateAttachments([
    {
      name: '  photo\u0000.png  ',
      mimeType: 'image/png; charset=binary',
      data: `data:image/png;base64,${PNG_BASE64}`,
    },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.attachments[0].mimeType, 'image/png');
  assert.equal(result.attachments[0].name, 'photo.png');
});

test('content builder emits image, file, and inlined text parts', () => {
  const result = validateAttachments([
    attachment('image/png', PNG_BASE64, 'photo.png'),
    attachment('application/pdf', PDF_BASE64, 'lesson.pdf'),
    attachment('text/plain', Buffer.from('آية اليوم', 'utf8').toString('base64'), 'note.txt'),
  ]);
  assert.equal(result.ok, true);

  const parts = buildUserContent('حلّل هذه الملفات', result.attachments);
  assert.equal(parts[0].type, 'text');
  assert.ok(parts.some((part) => part.type === 'image'));
  assert.ok(parts.some((part) => part.type === 'file' && part.filename === 'lesson.pdf'));
  assert.ok(
    parts.some(
      (part) => part.type === 'text' && part.text.includes('ملف نصي مرفق') && part.text.includes('آية اليوم'),
    ),
  );
});

test('content builder falls back to an analysis prompt when no text was typed', () => {
  const result = validateAttachments([attachment('image/png', PNG_BASE64, 'photo.png')]);
  assert.equal(result.ok, true);
  const parts = buildUserContent('   ', result.attachments);
  assert.equal(parts[0].type, 'text');
  assert.match(parts[0].text, /ملخصًا/);
});

test('model capability checks block images and PDFs for text-only models', () => {
  const oss = getModelById('gpt-oss-20b');
  const vision = getModelById('gemini-3.8-flash');

  const images = validateAttachments([attachment('image/png', PNG_BASE64, 'photo.png')]);
  const pdfs = validateAttachments([attachment('application/pdf', PDF_BASE64, 'lesson.pdf')]);
  assert.equal(images.ok, true);
  assert.equal(pdfs.ok, true);

  assert.match(modelAttachmentError(oss, images.attachments), /لا يدعم تحليل الصور/);
  assert.match(modelAttachmentError(oss, pdfs.attachments), /لا يدعم قراءة PDF/);
  assert.equal(modelAttachmentError(vision, images.attachments), null);
  assert.equal(modelAttachmentError(vision, pdfs.attachments), null);
});

test('MIME classification covers the accepted upload types', () => {
  assert.equal(classifyMimeType('image/jpeg'), 'image');
  assert.equal(classifyMimeType('application/pdf'), 'pdf');
  assert.equal(classifyMimeType('text/csv'), 'text');
  assert.equal(classifyMimeType('application/json'), 'text');
  assert.equal(classifyMimeType('application/zip'), null);
});

test('SovereignEG adapter sends images and PDFs as OpenAI-compatible parts', async () => {
  const adapter = new SovereignEGAdapter();
  const model = getModelById('gemini-3.8-flash');
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.SOVEREIGNEG_API_KEY;
  process.env.SOVEREIGNEG_API_KEY = 'test-sovereigneg-key';
  let captured = null;

  try {
    globalThis.fetch = async (_url, init) => {
      captured = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          model: model.apiModelId,
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    await adapter.chatCompletion(model, {
      modelId: model.id,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'حلّل المرفقات' },
            { type: 'image', mimeType: 'image/png', data: PNG_BASE64 },
            {
              type: 'file',
              mimeType: 'application/pdf',
              filename: 'lesson.pdf',
              data: PDF_BASE64,
            },
          ],
        },
      ],
    });

    const parts = captured.messages[0].content;
    assert.deepEqual(parts[0], { type: 'text', text: 'حلّل المرفقات' });
    assert.deepEqual(parts[1], {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${PNG_BASE64}` },
    });
    assert.deepEqual(parts[2], {
      type: 'file',
      file: {
        filename: 'lesson.pdf',
        file_data: `data:application/pdf;base64,${PDF_BASE64}`,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.SOVEREIGNEG_API_KEY;
    else process.env.SOVEREIGNEG_API_KEY = originalKey;
  }
});
