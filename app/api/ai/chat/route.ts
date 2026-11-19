import { withTenant } from '@/src/server/tenant/route';
import {
  getAuthUser,
  jsonResponse,
  unauthorized,
  badRequest,
  serverError,
} from '@/src/server/middleware';
import { aiService } from '@/src/server/ai/service';
import { ChatMessage } from '@/src/server/ai/types';

async function handler(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return unauthorized();

    const body = await req.json();
    const { modelId, messages, stream = true } = body;

    if (!modelId || typeof modelId !== 'string') {
      return badRequest('معرف النموذج (modelId) مطلوب.');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return badRequest('قائمة الرسائل (messages) مطلوبة ولا يمكن أن تكون فارغة.');
    }

    const sanitizedMessages: ChatMessage[] = [];
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue;
      const role = m.role;
      if (!['system', 'user', 'assistant'].includes(role)) continue;
      const content = typeof m.content === 'string' ? m.content : '';
      sanitizedMessages.push({ role, content });
    }

    if (sanitizedMessages.length === 0) {
      return badRequest('الرسائل غير صالحة.');
    }

    // System instruction for Sunday School context
    const hasSystemMessage = sanitizedMessages.some((m) => m.role === 'system');
    if (!hasSystemMessage) {
      sanitizedMessages.unshift({
        role: 'system',
        content: `أنت المساعد الذكي المتخصص لمنصة مدارس الأحد (مدارس الأحد - كنيسة العذراء مريم). 
مهمتك مساعدة الخدام وأمناء الخدمة والآباء الكهنة في:
1. تحضير دروس مدارس الأحد بأسلوب كنسي أرثوذكسي ملهم يناسب الأعمار المختلفة (ابتدائي، إعدادي، ثانوي).
2. اقتراح وسائل إيضاح، ألعاب تفاعلية، وأنشطة روحية ومسابقات.
3. صياغة أسئلة تقييمية ومسابقات ومراجعات مع شواهد كتابية دقيقة.
4. تحليل تقارير الحضور والغياب وتقديم مقترحات للافتقاد والمتابعة الرعوية.
5. الإجابة بدقة وبأسلوب محب وودود ومحفز للخدام.`,
      });
    }

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
            const errorMsg =
              err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالنموذج.';
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
        },
      });
    } else {
      const result = await aiService.chat({
        modelId,
        messages: sanitizedMessages,
      });

      return jsonResponse(result);
    }
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'تعذر إتمام طلب الذكاء الاصطناعي.';
    return serverError(msg);
  }
}

export const POST = withTenant(handler);
