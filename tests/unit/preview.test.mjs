import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePreviewStatus } from '../../src/server/platform/preview-policy.ts';

const preview = {
  mode: 'PREVIEW',
  officialLaunchDate: '',
  startDate: '',
  endDate: '',
  subscriptionsEnabled: true,
  paymentsEnabled: true,
};

test('unconfigured Preview has no fabricated dates and keeps core access free', () => {
  const result = derivePreviewStatus(preview, new Date('2026-11-12T12:00:00Z'));
  assert.equal(result.phase, 'unconfigured');
  assert.equal(result.officialLaunchDate, '');
  assert.equal(result.startDate, '');
  assert.equal(result.endDate, '');
  assert.equal(result.daysRemaining, 0);
  assert.equal(result.freeAccess, true);
  assert.equal(result.subscriptionsEnabled, false);
  assert.equal(result.paymentsEnabled, false);
});

test('configured Preview follows the single launch date and remains exactly two years', () => {
  const result = derivePreviewStatus({
    ...preview,
    officialLaunchDate: '2026-11-12',
    startDate: '2026-11-12',
    endDate: '2028-11-12',
    subscriptionsEnabled: false,
    paymentsEnabled: false,
  }, new Date('2027-11-12T12:00:00Z'));
  assert.equal(result.phase, 'active');
  assert.equal(result.isActive, true);
  assert.equal(result.daysRemaining, 366);
});

test('mismatched Preview dates are not treated as an active program', () => {
  const result = derivePreviewStatus({
    ...preview,
    officialLaunchDate: '2026-11-12',
    startDate: '2026-11-13',
    endDate: '2028-11-12',
  }, new Date('2027-11-12T12:00:00Z'));
  assert.equal(result.phase, 'unconfigured');
  assert.equal(result.isActive, false);
});

test('two-year Preview end date clamps leap day to the final day of February', () => {
  const result = derivePreviewStatus({
    ...preview,
    officialLaunchDate: '2024-02-29',
    startDate: '2024-02-29',
    endDate: '2026-02-28',
    subscriptionsEnabled: false,
    paymentsEnabled: false,
  }, new Date('2025-02-28T12:00:00Z'));
  assert.equal(result.phase, 'active');
  assert.equal(result.endDate, '2026-02-28');
});
