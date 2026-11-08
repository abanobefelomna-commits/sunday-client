import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ValidationError,
  addDays,
  daysBetween,
  isIsoDate,
  isUuid,
  oneOf,
  optionalText,
  parseDateRange,
  parsePagination,
  requiredText,
  todayIso,
} from '../../src/server/validation.ts';

const UUID = '550e8400-e29b-41d4-a716-446655440000';

test('isUuid accepts canonical UUIDs and rejects malformed values', () => {
  assert.equal(isUuid(UUID), true);
  assert.equal(isUuid(UUID.toUpperCase()), true);
  assert.equal(isUuid('00000000-0000-4000-8000-000000000000'), true);
  for (const value of [
    null,
    undefined,
    123,
    '',
    'not-a-uuid',
    '550e8400-e29b-61d4-a716-446655440000',
    '550e8400-e29b-41d4-c716-446655440000',
    '550e8400e29b41d4a716446655440000',
  ]) {
    assert.equal(isUuid(value), false, String(value));
  }
});

test('isIsoDate validates real calendar dates including leap years', () => {
  assert.equal(isIsoDate('2026-11-08'), true);
  assert.equal(isIsoDate('2024-02-29'), true);
  assert.equal(isIsoDate('2023-02-29'), false);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(isIsoDate('2026-00-10'), false);
  assert.equal(isIsoDate('2026-1-1'), false);
  assert.equal(isIsoDate('08/11/2026'), false);
  assert.equal(isIsoDate(null), false);
});

test('todayIso derives the UTC date deterministically', () => {
  assert.equal(todayIso(new Date('2026-11-08T23:59:59Z')), '2026-11-08');
  assert.equal(todayIso(new Date('2026-11-09T00:00:00Z')), '2026-11-09');
});

test('addDays and daysBetween handle month and year boundaries', () => {
  assert.equal(addDays('2026-11-08', 30), '2026-12-08');
  assert.equal(addDays('2026-11-08', 60), '2027-01-07');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(daysBetween('2026-11-08', '2026-12-08'), 30);
  assert.equal(daysBetween('2026-12-08', '2026-11-08'), -30);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
});

test('parsePagination clamps invalid and oversized values', () => {
  const params = new URLSearchParams();
  assert.deepEqual(parsePagination(params), { page: 1, limit: 20, offset: 0 });

  const custom = new URLSearchParams({ page: '3', limit: '15' });
  assert.deepEqual(parsePagination(custom), { page: 3, limit: 15, offset: 30 });

  const invalid = new URLSearchParams({ page: '0', limit: 'abc' });
  assert.deepEqual(parsePagination(invalid), { page: 1, limit: 20, offset: 0 });

  const clamped = new URLSearchParams({ page: '-4', limit: '1000' });
  assert.deepEqual(parsePagination(clamped, { maxLimit: 100 }), {
    page: 1,
    limit: 100,
    offset: 0,
  });
});

test('parseDateRange applies defaults, explicit ranges and guardrails', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  assert.deepEqual(parseDateRange(new URLSearchParams(), { now }), {
    from: '2026-08-11',
    to: '2026-11-08',
  });

  assert.deepEqual(
    parseDateRange(new URLSearchParams({ from: '2026-01-01', to: '2026-11-08' }), { now }),
    { from: '2026-01-01', to: '2026-11-08' },
  );

  assert.throws(
    () => parseDateRange(new URLSearchParams({ from: '2026-11-09', to: '2026-11-08' }), { now }),
    (error) => error instanceof ValidationError && /البداية/.test(error.message),
  );

  assert.throws(
    () =>
      parseDateRange(new URLSearchParams({ from: '2025-01-01', to: '2026-11-08' }), {
        now,
        maxDays: 366,
      }),
    (error) => error instanceof ValidationError && /أقصى مدة/.test(error.message),
  );

  const malformed = parseDateRange(
    new URLSearchParams({ from: 'nope', to: '2026-11-08' }),
    { now },
  );
  assert.equal(malformed.from, '2026-08-11');
});

test('oneOf accepts only declared values', () => {
  assert.equal(oneOf('present', ['present', 'absent']), 'present');
  assert.equal(oneOf('nope', ['present', 'absent']), null);
  assert.equal(oneOf(null, ['present']), null);
  assert.equal(oneOf(3, ['present']), null);
});

test('requiredText trims, rejects blanks and enforces max length', () => {
  assert.equal(requiredText('  hello  ', 'الاسم', 10), 'hello');
  assert.throws(
    () => requiredText('   ', 'الاسم'),
    (error) => error instanceof ValidationError && error.message.includes('الاسم'),
  );
  assert.throws(
    () => requiredText('abcdef', 'الاسم', 3),
    (error) => error instanceof ValidationError && error.message.includes('3'),
  );
});

test('optionalText normalizes empty values and truncates safely', () => {
  assert.equal(optionalText(undefined), null);
  assert.equal(optionalText(null), null);
  assert.equal(optionalText(42), null);
  assert.equal(optionalText('   '), null);
  assert.equal(optionalText('  hello  '), 'hello');
  assert.equal(optionalText('abcdef', 3), 'abc');
});
