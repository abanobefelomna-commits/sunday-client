/**
 * Shared password policy. Kept free of server-only imports so the browser can
 * validate before submitting and the server can enforce the same rules.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordPolicyIssue =
  | 'too_short'
  | 'too_long'
  | 'missing_letter'
  | 'missing_number';

export type PasswordPolicyMessageKey =
  | 'password.tooShort'
  | 'password.tooLong'
  | 'password.missingLetter'
  | 'password.missingNumber';

const PASSWORD_ISSUE_KEYS: Record<PasswordPolicyIssue, PasswordPolicyMessageKey> = {
  too_short: 'password.tooShort',
  too_long: 'password.tooLong',
  missing_letter: 'password.missingLetter',
  missing_number: 'password.missingNumber',
};

export function passwordPolicyMessageKey(issue: PasswordPolicyIssue): PasswordPolicyMessageKey {
  return PASSWORD_ISSUE_KEYS[issue];
}

export function passwordPolicyIssue(password: unknown): PasswordPolicyIssue | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return 'too_short';
  }
  if (password.length > PASSWORD_MAX_LENGTH) return 'too_long';
  if (!/\p{L}/u.test(password)) return 'missing_letter';
  if (!/\p{N}/u.test(password)) return 'missing_number';
  return null;
}
