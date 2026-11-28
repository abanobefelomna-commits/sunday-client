import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('Firebase web config is pinned to the existing project and opt-in', () => {
  const config = read('src/lib/firebase/config.ts');

  assert.match(config, /FIREBASE_PROJECT_ID = "sunday-school-5e9b2"/);
  assert.match(config, /NEXT_PUBLIC_FIREBASE_AUTH_ENABLED/);
  assert.match(config, /projectMismatch/);
  assert.doesNotMatch(config, /private_key|PRIVATE_KEY|serviceAccount/i);
});

test('Firebase Admin SDK stays server-only and never initialises Firestore', () => {
  const admin = read('src/server/firebase/admin.ts');

  assert.match(admin, /FIREBASE_SERVICE_ACCOUNT_JSON/);
  assert.match(admin, /typeof window !== "undefined"/);
  assert.doesNotMatch(admin, /firebase-admin\/firestore|getFirestore/);
  assert.doesNotMatch(read('src/lib/firebase/client.ts'), /firebase-admin/);
});

test('Firebase identity link lives in the tenant database, not Firestore', () => {
  const identities = read('src/server/firebase/identities.ts');
  const migration = read('db/tenant/012_firebase_identity.sql');

  assert.match(identities, /FROM "users" WHERE "firebaseUid" = \$1/);
  assert.doesNotMatch(identities, /firestore|collection\(/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "firebaseUid"/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_firebaseUid"/);
  assert.match(migration, /012_firebase_identity/);
});

test('Firebase session exchange verifies the token and keeps app authorization', () => {
  const route = read('app/api/auth/firebase/session/route.ts');

  assert.match(route, /verifyFirebaseIdToken/);
  assert.match(route, /requireSameOrigin\(req\)/);
  assert.match(route, /rateLimit\(`firebase-session:/);
  assert.match(route, /withResolvedTenant/);
  assert.match(route, /signAccessToken/);
  assert.match(route, /issueRefreshToken/);
  assert.match(route, /if \(!user\.isActive\)/);
  // Email matching is only allowed for Firebase-verified addresses.
  assert.match(route, /firebaseUser\.email && firebaseUser\.emailVerified/);
  assert.doesNotMatch(route, /setCustomUserClaims|syncFirebaseAccess|memberships/);
});

test('registration stores the Firebase UID and never a usable local password', () => {
  const route = read('app/api/auth/register/route.ts');

  assert.match(route, /"firebaseUid"/);
  assert.match(route, /firebaseUser\?\.uid \?\? null/);
  assert.match(route, /randomBytes\(32\)/);
  assert.match(route, /validatePasswordStrength\(password\)/);
  assert.match(route, /requiresEmailVerification: firebaseUser \? !firebaseUser\.emailVerified : false/);
  assert.match(route, /normalizeEmail\(firebaseUser\.email\) !== email/);
  assert.doesNotMatch(route, /syncFirebaseAccess/);
});

test('email verification is sent by Firebase and trusted only from the token', () => {
  const clientAuth = read('src/lib/firebase/auth.ts');
  const api = read('app/lib/api.ts');
  const session = read('app/api/auth/firebase/session/route.ts');

  assert.match(clientAuth, /sendEmailVerification/);
  assert.match(clientAuth, /if \(!user \|\| user\.emailVerified\) return/);
  assert.match(api, /if \(result\.requiresEmailVerification\) await sendFirebaseEmailVerification\(\)/);
  assert.match(api, /await discardFirebaseAccount\(\)/);
  assert.match(api, /await signOutFirebase\(\)/);
  assert.match(session, /payload\.email_verified === true|firebaseUser\.emailVerified/);
});
