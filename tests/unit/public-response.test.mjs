import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizePublicSuccess } from '../../src/server/public-response.ts';

test('public church directory exposes only bounded directory fields', () => {
  const result = sanitizePublicSuccess('GET', 'churches', {
    data: [{
      id: 'private-database-id',
      slug: 'st-mary',
      name: 'St Mary Church',
      city: 'Cairo',
      publicDescription: 'Synthetic public description',
      verificationStatus: 'verified',
      churchCode: 'private-code',
      databaseUrl: 'must-not-leak',
      children: [{ name: 'private child' }],
    }],
    internalStatus: 'private',
  });

  assert.deepEqual(result, {
    data: [{
      slug: 'st-mary',
      name: 'St Mary Church',
      city: 'Cairo',
      publicDescription: 'Synthetic public description',
      verificationStatus: 'verified',
    }],
  });
});

test('public registration provisioning response requires an opaque token and UUID job ID', () => {
  const accepted = sanitizePublicSuccess('POST', 'church-registrations', {
    jobId: '17d5aa93-434f-4c5e-911c-2724d1d04a97',
    provisioningToken: 'a'.repeat(48),
    databaseUrl: 'must-not-leak',
  });
  assert.equal(accepted?.jobId, '17d5aa93-434f-4c5e-911c-2724d1d04a97');
  assert.equal(accepted?.provisioningToken, 'a'.repeat(48));
  assert.equal(accepted && Object.hasOwn(accepted, 'databaseUrl'), false);
  assert.equal(sanitizePublicSuccess('POST', 'church-registrations', { jobId: 'bad', provisioningToken: 'short' }), null);
});

test('provisioning status strips upstream error details and clamps progress', () => {
  const result = sanitizePublicSuccess('GET', 'church-registrations/17d5aa93-434f-4c5e-911c-2724d1d04a97/status', {
    status: 'failed',
    progress: 180,
    error: { message: 'postgres://secret@host/db' },
    debug: 'must-not-leak',
  });
  assert.deepEqual(result, { status: 'failed', progress: 100 });
  assert.equal(sanitizePublicSuccess('GET', 'church-registrations/17d5aa93-434f-4c5e-911c-2724d1d04a97/status', { status: 'succeeded' }), null);
  assert.deepEqual(sanitizePublicSuccess('GET', 'church-registrations/17d5aa93-434f-4c5e-911c-2724d1d04a97/status', { status: 'succeeded', churchCode: 'SS_safe-code-7' }), { status: 'succeeded', churchCode: 'SS_safe-code-7' });
});

test('church code lookup and join request reject unsafe public response shapes', () => {
  assert.equal(sanitizePublicSuccess('POST', 'church-code/lookup', { church: { slug: 'st-mary', name: 'St Mary', churchCode: 'secret' } })?.church?.churchCode, undefined);
  assert.equal(sanitizePublicSuccess('POST', 'join-requests', { status: 'approved', membershipId: 'private' }), null);
  assert.deepEqual(sanitizePublicSuccess('POST', 'join-requests', { status: 'pending', membershipId: 'private' }), { status: 'pending' });
});

test('preview response admits only validated platform mode and official dates', () => {
  assert.deepEqual(sanitizePublicSuccess('GET', 'preview', {
    mode: 'PREVIEW',
    officialLaunchDate: '2026-02-30',
    previewEndDate: '2028-05-20',
    paymentsEnabled: false,
    secret: 'must-not-leak',
  }), { mode: 'PREVIEW', previewEndDate: '2028-05-20', paymentsEnabled: false });
});
