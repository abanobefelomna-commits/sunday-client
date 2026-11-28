import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { FIREBASE_PROJECT_ID } from "../../lib/firebase/config";
import { getFirebaseAdminAuth, isFirebaseAdminConfigured } from "./admin";

/**
 * Verify a Firebase ID token on the server.
 *
 * Preferred path: the Admin SDK (`verifyIdToken`) when service-account
 * credentials are configured — it also checks revocation.
 *
 * Fallback path: verify the RS256 signature against Google's public JWKS and
 * validate issuer/audience/subject. This is the documented way to validate
 * Firebase ID tokens without a service account, so email/password sign-in
 * works before Admin credentials are added to the deployment.
 */

const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  signInProvider: string | null;
}

export class FirebaseTokenError extends Error {
  constructor(message = "Invalid Firebase ID token") {
    super(message);
    this.name = "FirebaseTokenError";
  }
}

function toVerifiedUser(payload: JWTPayload): VerifiedFirebaseUser {
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw new FirebaseTokenError("Firebase token has no subject");

  const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
    displayName: typeof payload.name === "string" ? payload.name : null,
    signInProvider: firebase?.sign_in_provider ?? null,
  };
}

async function verifyWithJwks(idToken: string): Promise<VerifiedFirebaseUser> {
  const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
    issuer: FIREBASE_ISSUER,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ["RS256"],
  });

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.iat !== "number" || payload.iat > now + 60) {
    throw new FirebaseTokenError("Firebase token issued in the future");
  }
  if (typeof payload.auth_time !== "number") {
    throw new FirebaseTokenError("Firebase token has no auth_time");
  }

  return toVerifiedUser(payload);
}

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedFirebaseUser> {
  const token = typeof idToken === "string" ? idToken.trim() : "";
  if (!token) throw new FirebaseTokenError("Missing Firebase ID token");
  if (token.length > 8192) throw new FirebaseTokenError("Firebase ID token too large");

  if (isFirebaseAdminConfigured()) {
    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(token, true);
      return toVerifiedUser(decoded as unknown as JWTPayload);
    } catch (error) {
      throw new FirebaseTokenError(
        error instanceof Error ? error.message : "Firebase token verification failed",
      );
    }
  }

  try {
    return await verifyWithJwks(token);
  } catch (error) {
    if (error instanceof FirebaseTokenError) throw error;
    throw new FirebaseTokenError(
      error instanceof Error ? error.message : "Firebase token verification failed",
    );
  }
}
