import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOtpCandidate,
  hashOtp,
  hashesEqual,
  OTP_MAX_ATTEMPTS,
} from '../../src/server/otp-core.ts';

test('hashOtp produces deterministic hex digest', () => {
  const hash1 = hashOtp('123456');
  const hash2 = hashOtp('123456');
  const hash3 = hashOtp('654321');
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test('hashesEqual performs timing safe comparison', () => {
  const h1 = hashOtp('123456');
  const h2 = hashOtp('123456');
  const h3 = hashOtp('999999');
  assert.equal(hashesEqual(h1, h2), true);
  assert.equal(hashesEqual(h1, h3), false);
});

test('evaluateOtpCandidate succeeds on matching unexpired code within attempt limits', () => {
  const codeHash = hashOtp('123456');
  const expiresAt = new Date(Date.now() + 60_000);
  const result = evaluateOtpCandidate({
    candidateFound: true,
    codeHash,
    expectedHash: codeHash,
    expiresAt,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });
  assert.equal(result.valid, true);
  assert.equal(result.outcome, 'valid');
});

test('evaluateOtpCandidate rejects missing candidate', () => {
  const result = evaluateOtpCandidate({
    candidateFound: false,
  });
  assert.equal(result.valid, false);
  assert.equal(result.outcome, 'not_found');
  assert.match(result.message, /الكود غير موجود/);
});

test('evaluateOtpCandidate rejects when attempts limit reached', () => {
  const codeHash = hashOtp('123456');
  const expiresAt = new Date(Date.now() + 60_000);
  const result = evaluateOtpCandidate({
    candidateFound: true,
    codeHash,
    expectedHash: codeHash,
    expiresAt,
    attempts: OTP_MAX_ATTEMPTS,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });
  assert.equal(result.valid, false);
  assert.equal(result.outcome, 'exhausted');
  assert.match(result.message, /استنفاد محاولات/);
});

test('evaluateOtpCandidate rejects expired code', () => {
  const codeHash = hashOtp('123456');
  const expiresAt = new Date(Date.now() - 1000); // 1 second ago
  const result = evaluateOtpCandidate({
    candidateFound: true,
    codeHash,
    expectedHash: codeHash,
    expiresAt,
    attempts: 1,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });
  assert.equal(result.valid, false);
  assert.equal(result.outcome, 'expired');
  assert.match(result.message, /انتهت صلاحية/);
});

test('evaluateOtpCandidate rejects mismatched code', () => {
  const codeHash = hashOtp('123456');
  const wrongHash = hashOtp('654321');
  const expiresAt = new Date(Date.now() + 60_000);
  const result = evaluateOtpCandidate({
    candidateFound: true,
    codeHash: wrongHash,
    expectedHash: codeHash,
    expiresAt,
    attempts: 1,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });
  assert.equal(result.valid, false);
  assert.equal(result.outcome, 'mismatch');
  assert.match(result.message, /غير صحيح/);
});
