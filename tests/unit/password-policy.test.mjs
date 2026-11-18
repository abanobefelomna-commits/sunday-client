import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicyIssue,
  passwordPolicyMessageKey,
} from '../../app/lib/password-policy.ts';

test('password policy requires at least ten characters', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 10);
  assert.equal(passwordPolicyIssue('Abcdefg12'), 'too_short');
  assert.equal(passwordPolicyIssue('Abcdefgh12'), null);
});

test('password policy caps the maximum length', () => {
  assert.equal(PASSWORD_MAX_LENGTH, 128);
  assert.equal(passwordPolicyIssue(`A1${'a'.repeat(127)}`), 'too_long');
});

test('password policy requires a letter and a number', () => {
  assert.equal(passwordPolicyIssue('1234567890'), 'missing_letter');
  assert.equal(passwordPolicyIssue('abcdefghij'), 'missing_number');
  assert.equal(passwordPolicyIssue('كلمةسر1234'), null);
});

test('password policy rejects non-string values', () => {
  assert.equal(passwordPolicyIssue(null), 'too_short');
  assert.equal(passwordPolicyIssue(undefined), 'too_short');
  assert.equal(passwordPolicyIssue(1234567890), 'too_short');
});

test('every policy issue maps to a translation key', () => {
  assert.equal(passwordPolicyMessageKey('too_short'), 'password.tooShort');
  assert.equal(passwordPolicyMessageKey('too_long'), 'password.tooLong');
  assert.equal(passwordPolicyMessageKey('missing_letter'), 'password.missingLetter');
  assert.equal(passwordPolicyMessageKey('missing_number'), 'password.missingNumber');
});
