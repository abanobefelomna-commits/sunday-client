import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { readFirebaseWebConfig, type FirebaseWebConfig } from "./config";

/**
 * Browser-only Firebase initialisation.
 *
 * The app is created once per page load and cached on `globalThis` so Fast
 * Refresh / hot reload in development never registers a second Firebase App
 * (which throws `app/duplicate-app`) or a second Auth instance.
 */
const APP_NAME = "sunday-school";
const CACHE_KEY = "__ssFirebaseClient";

interface FirebaseClientCache {
  app: FirebaseApp;
  auth: Auth;
  apiKey: string;
}

type FirebaseGlobal = typeof globalThis & {
  [CACHE_KEY]?: FirebaseClientCache;
};

const firebaseGlobal = globalThis as FirebaseGlobal;

function createClient(config: FirebaseWebConfig): FirebaseClientCache {
  const existing = getApps().find((app) => app.name === APP_NAME);
  const app = existing ?? initializeApp(config, APP_NAME);
  const auth = getAuth(app);
  // Browser persistence is Firebase's default (`browserLocalPersistence`), so
  // the Firebase session survives reloads; the application's httpOnly cookie
  // session remains the authority for API authorisation.
  return { app, auth, apiKey: config.apiKey };
}

export function getFirebaseClientApp(): FirebaseApp {
  return clientCache().app;
}

export function getFirebaseClientAuth(): Auth {
  return clientCache().auth;
}

function clientCache(): FirebaseClientCache {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK can only be used in the browser.");
  }

  const config = readFirebaseWebConfig();
  if (!config) {
    throw new Error("Firebase Web App configuration is missing or invalid.");
  }

  const cached = firebaseGlobal[CACHE_KEY];
  if (cached && cached.apiKey === config.apiKey) return cached;

  const created = createClient(config);
  firebaseGlobal[CACHE_KEY] = created;
  return created;
}

/** Test/teardown helper: forget the cached client without touching Firebase. */
export function resetFirebaseClientCache(): void {
  delete firebaseGlobal[CACHE_KEY];
}
