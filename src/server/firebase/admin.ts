import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { FIREBASE_PROJECT_ID } from "../../lib/firebase/config";

/**
 * Server-only Firebase Admin SDK initialisation.
 *
 * Credentials are read from environment variables and never leave the server:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON  full service-account JSON (or base64 JSON)
 *   - FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY  split service-account form
 *   - otherwise Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS)
 *
 * When no credentials are present the module reports itself as unconfigured and
 * callers must degrade explicitly. It must never be imported from client code.
 */

const ADMIN_APP_NAME = "sunday-school-admin";
const CACHE_KEY = "__ssFirebaseAdmin";

interface AdminCache {
  auth: Auth;
}

type AdminGlobal = typeof globalThis & { [CACHE_KEY]?: AdminCache };

const adminGlobal = globalThis as AdminGlobal;

export class FirebaseAdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase Admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (recommended) or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
    );
    this.name = "FirebaseAdminNotConfiguredError";
  }
}

function env(name: string): string {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

interface ServiceAccountEnv {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function serviceAccountFromEnv(): ServiceAccountEnv | null {
  const rawJson = env("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (rawJson) {
    const json = rawJson.startsWith("{")
      ? rawJson
      : Buffer.from(rawJson, "base64").toString("utf8");
    const parsed = JSON.parse(json) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email or private_key.",
      );
    }
    return {
      projectId: parsed.project_id || FIREBASE_PROJECT_ID,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_PRIVATE_KEY");
  if (clientEmail && privateKey) {
    return {
      projectId: env("FIREBASE_ADMIN_PROJECT_ID") || FIREBASE_PROJECT_ID,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

/** True when the Admin SDK has usable credentials (or ADC is expected). */
export function isFirebaseAdminConfigured(): boolean {
  if (env("FIREBASE_SERVICE_ACCOUNT_JSON")) return true;
  if (env("FIREBASE_CLIENT_EMAIL") && env("FIREBASE_PRIVATE_KEY")) return true;
  if (env("GOOGLE_APPLICATION_CREDENTIALS")) return true;
  return false;
}

function createAdminApp(): App {
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const account = serviceAccountFromEnv();
  if (account) {
    if (account.projectId !== FIREBASE_PROJECT_ID) {
      throw new Error(
        `Firebase Admin credentials belong to project "${account.projectId}", expected "${FIREBASE_PROJECT_ID}".`,
      );
    }
    return initializeApp(
      {
        credential: cert({
          projectId: account.projectId,
          clientEmail: account.clientEmail,
          privateKey: account.privateKey,
        }),
        projectId: account.projectId,
      },
      ADMIN_APP_NAME,
    );
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: env("FIREBASE_ADMIN_PROJECT_ID") || FIREBASE_PROJECT_ID,
    },
    ADMIN_APP_NAME,
  );
}

function adminCache(): AdminCache {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin SDK is server-only.");
  }
  const cached = adminGlobal[CACHE_KEY];
  if (cached) return cached;

  const app = createAdminApp();
  const created: AdminCache = { auth: getAuth(app) };
  adminGlobal[CACHE_KEY] = created;
  return created;
}

export function getFirebaseAdminAuth(): Auth {
  if (!isFirebaseAdminConfigured()) throw new FirebaseAdminNotConfiguredError();
  return adminCache().auth;
}


