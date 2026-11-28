/**
 * Public Firebase Web App configuration.
 *
 * Everything exported here is safe to ship to the browser: the Firebase Web
 * App config (apiKey / appId / projectId) is a public identifier, not a secret.
 * Access control is enforced by Firebase Authentication, Firestore Security
 * Rules, and the application's own server routes — never by hiding this file.
 *
 * Server-only credentials (service account) live in
 * `src/server/firebase/admin.ts` and must never be imported from client code.
 */

/** The single Firebase project this application is allowed to talk to. */
export const FIREBASE_PROJECT_ID = "sunday-school-5e9b2";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export interface FirebaseConfigProblem {
  missing: string[];
  projectMismatch?: { expected: string; received: string };
}

function readEnv(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when it is read with a
 * static member expression, so every value below is read literally.
 */
export function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const config: FirebaseWebConfig = {
    apiKey: readEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: readEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: readEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: readEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || undefined,
    messagingSenderId:
      readEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || undefined,
    appId: readEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };

  const problem = firebaseWebConfigProblem(config);
  return problem ? null : config;
}

export function firebaseWebConfigProblem(
  config: Partial<FirebaseWebConfig>,
): FirebaseConfigProblem | null {
  const missing = (["apiKey", "authDomain", "projectId", "appId"] as const).filter(
    (key) => !config[key],
  );

  const problem: FirebaseConfigProblem = { missing: [...missing] };

  if (config.projectId && config.projectId !== FIREBASE_PROJECT_ID) {
    problem.projectMismatch = {
      expected: FIREBASE_PROJECT_ID,
      received: config.projectId,
    };
  }

  return problem.missing.length === 0 && !problem.projectMismatch ? null : problem;
}

/**
 * Firebase Auth is opt-in. Until `NEXT_PUBLIC_FIREBASE_AUTH_ENABLED` is
 * `"true"` the application keeps using its existing email/password login,
 * so a partially configured environment can never lock users out.
 */
export function isFirebaseAuthEnabled(): boolean {
  if (readEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED) !== "true") return false;
  return readFirebaseWebConfig() !== null;
}

/** Throws when Firebase is enabled but the Web App config is incomplete. */
export function requireFirebaseWebConfig(): FirebaseWebConfig {
  const config = readFirebaseWebConfig();
  if (!config) {
    const problem = firebaseWebConfigProblem({
      apiKey: readEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
      authDomain: readEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
      projectId: readEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      appId: readEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    });
    const details = [
      problem?.missing.length ? `missing: ${problem.missing.join(", ")}` : null,
      problem?.projectMismatch
        ? `projectId must be ${problem.projectMismatch.expected}`
        : null,
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(`Firebase Web App configuration is incomplete (${details}).`);
  }
  return config;
}
