/**
 * Interactive reply protocol for the assistant.
 *
 * The model may end a reply with up to two fenced blocks:
 *   ```ask   {"question": "...", "options": ["...", "..."]}
 *   ```next  ["follow-up 1", "follow-up 2"]
 * They are parsed here, removed from the visible text, and rendered as
 * tappable chips. Malformed blocks are dropped silently (never shown raw).
 */

export interface AskBlock {
  question: string;
  options: string[];
}

export interface ParsedReply {
  text: string;
  ask: AskBlock | null;
  next: string[];
}

const MAX_OPTIONS = 5;
const MAX_OPTION_LENGTH = 80;
const MAX_QUESTION_LENGTH = 200;

function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = item.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_OPTION_LENGTH || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

const BLOCK_RE = /```(ask|next)[ \t]*\r?\n([\s\S]*?)```/g;
// An unfinished block while streaming: hide it instead of flashing raw JSON.
const OPEN_BLOCK_RE = /```(?:ask|next)[ \t]*(?:\r?\n[\s\S]*)?$/;

export function parseInteractiveReply(content: string, streaming = false): ParsedReply {
  let ask: AskBlock | null = null;
  let next: string[] = [];

  let text = content.replace(BLOCK_RE, (_match, kind: string, body: string) => {
    try {
      const data: unknown = JSON.parse(body.trim());
      if (kind === 'ask' && data && typeof data === 'object' && !Array.isArray(data)) {
        const question =
          typeof (data as { question?: unknown }).question === 'string'
            ? (data as { question: string }).question.trim().slice(0, MAX_QUESTION_LENGTH)
            : '';
        const options = cleanOptions((data as { options?: unknown }).options);
        if (question && options.length >= 2) ask = { question, options };
      } else if (kind === 'next') {
        next = cleanOptions(data);
      }
    } catch {
      // Ignore malformed JSON.
    }
    return '';
  });

  if (streaming) text = text.replace(OPEN_BLOCK_RE, '');
  return { text: text.trim(), ask, next };
}
