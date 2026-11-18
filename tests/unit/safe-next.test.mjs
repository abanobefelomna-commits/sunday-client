import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath } from '../../app/lib/safe-next.ts';

test('safeNextPath accepts safe relative paths', () => {
  assert.equal(safeNextPath('/dashboard'), '/dashboard');
  assert.equal(safeNextPath('/children/123'), '/children/123');
  assert.equal(safeNextPath('/attendance?classId=abc&date=2026-11-16'), '/attendance?classId=abc&date=2026-11-16');
  assert.equal(safeNextPath('/profile#section'), '/profile#section');
});

test('safeNextPath rejects external absolute URLs', () => {
  assert.equal(safeNextPath('https://evil.com'), '/dashboard');
  assert.equal(safeNextPath('http://evil.com/phish'), '/dashboard');
  assert.equal(safeNextPath('ftp://attacker.org'), '/dashboard');
});

test('safeNextPath rejects protocol-relative URLs', () => {
  assert.equal(safeNextPath('//evil.com'), '/dashboard');
  assert.equal(safeNextPath('///evil.com'), '/dashboard');
  assert.equal(safeNextPath('////evil.com/path'), '/dashboard');
});

test('safeNextPath rejects backslash bypasses', () => {
  assert.equal(safeNextPath('/\\evil.com'), '/dashboard');
  assert.equal(safeNextPath('/\\/evil.com'), '/dashboard');
  assert.equal(safeNextPath('\\evil.com'), '/dashboard');
  assert.equal(safeNextPath('/path\\evil.com'), '/dashboard');
});

test('safeNextPath rejects encoded bypasses and schemes', () => {
  assert.equal(safeNextPath('/%2fevil.com'), '/dashboard');
  assert.equal(safeNextPath('/%5cevil.com'), '/dashboard');
  assert.equal(safeNextPath('javascript:alert(1)'), '/dashboard');
  assert.equal(safeNextPath('data:text/html;base64,...'), '/dashboard');
  assert.equal(safeNextPath('/http:evil.com'), '/dashboard');
});

test('safeNextPath rejects control characters and CRLF', () => {
  assert.equal(safeNextPath('/dashboard\r\nSet-Cookie: evil=1'), '/dashboard');
  assert.equal(safeNextPath('/dashboard\0evil'), '/dashboard');
  assert.equal(safeNextPath('/dashboard%00evil'), '/dashboard');
});

test('safeNextPath respects custom fallback or null', () => {
  assert.equal(safeNextPath('//evil.com', null), null);
  assert.equal(safeNextPath('https://evil.com', '/login'), '/login');
  assert.equal(safeNextPath(undefined, null), null);
});
