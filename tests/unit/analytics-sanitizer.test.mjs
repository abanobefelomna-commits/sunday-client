import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeAnalyticsUrl } from '../../app/lib/analytics-sanitizer.ts';

const CHILD_ID = '17d5aa93-434f-4c5e-911c-2724d1d04a97';

test('analytics sanitizer strips query strings and hashes', () => {
  assert.equal(
    sanitizeAnalyticsUrl(`/children/${CHILD_ID}?name=secret#notes`),
    '/children/[id]',
  );
});

test('analytics sanitizer replaces UUID path segments', () => {
  assert.equal(
    sanitizeAnalyticsUrl(`/classes/${CHILD_ID}/children/${CHILD_ID}/profile?tab=notes`),
    '/classes/[id]/children/[id]/profile',
  );
});

test('analytics sanitizer keeps absolute origins but removes secrets', () => {
  assert.equal(
    sanitizeAnalyticsUrl(`https://app.example.com/children/${CHILD_ID}?token=abc#x`),
    'https://app.example.com/children/[id]',
  );
});

test('analytics sanitizer leaves non-UUID identifiers alone', () => {
  assert.equal(sanitizeAnalyticsUrl('/classes/first-grade?year=2026'), '/classes/first-grade');
  assert.equal(sanitizeAnalyticsUrl('/'), '/');
});

test('analytics sanitizer handles empty and malformed values safely', () => {
  assert.equal(sanitizeAnalyticsUrl(''), '/');
  assert.equal(sanitizeAnalyticsUrl('   '), '/');
  assert.equal(sanitizeAnalyticsUrl(null), '/');
  assert.equal(sanitizeAnalyticsUrl('http://[invalid'), '/');
});

test('analytics sanitizer replaces uppercase UUIDs', () => {
  assert.equal(
    sanitizeAnalyticsUrl(`/attendance/${CHILD_ID.toUpperCase()}`),
    '/attendance/[id]',
  );
});
