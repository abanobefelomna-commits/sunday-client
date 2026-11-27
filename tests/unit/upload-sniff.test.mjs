import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffImageMime } from '../../src/server/upload.ts';

test('recognises real JPEG, PNG and WEBP signatures', () => {
  assert.equal(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  assert.equal(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
  assert.equal(sniffImageMime(webp), 'image/webp');
});

test('rejects SVG, HTML and renamed non-image content', () => {
  assert.equal(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniffImageMime(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(sniffImageMime(Buffer.from('')), null);
});
