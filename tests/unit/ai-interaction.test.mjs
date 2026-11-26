import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInteractiveReply } from '../../app/lib/ai-interaction.ts';

test('extracts ask and next blocks and strips them from the text', () => {
  const reply = [
    'مرحبًا 🙏',
    '```ask',
    '{"question":"لأي فصل؟","options":["الأول","الثاني","الثالث"]}',
    '```',
    '```next',
    '["حضّر لي نشاطًا","اقترح أسئلة"]',
    '```',
  ].join('\n');
  const parsed = parseInteractiveReply(reply);
  assert.equal(parsed.text, 'مرحبًا 🙏');
  assert.deepEqual(parsed.ask, { question: 'لأي فصل؟', options: ['الأول', 'الثاني', 'الثالث'] });
  assert.deepEqual(parsed.next, ['حضّر لي نشاطًا', 'اقترح أسئلة']);
});

test('drops malformed or too-small blocks without showing raw JSON', () => {
  const parsed = parseInteractiveReply('نص\n```ask\n{not json}\n```\n```next\n"x"\n```');
  assert.equal(parsed.text, 'نص');
  assert.equal(parsed.ask, null);
  assert.deepEqual(parsed.next, []);
});

test('ask needs at least two options', () => {
  const parsed = parseInteractiveReply('```ask\n{"question":"س","options":["واحد"]}\n```');
  assert.equal(parsed.ask, null);
});

test('hides an unfinished block while streaming', () => {
  const parsed = parseInteractiveReply('نص\n```ask\n{"question":"ل', true);
  assert.equal(parsed.text, 'نص');
});

test('limits and de-duplicates options', () => {
  const opts = JSON.stringify(['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
  const parsed = parseInteractiveReply('```next\n' + opts + '\n```');
  assert.deepEqual(parsed.next, ['a', 'b', 'c', 'd', 'e']);
});
