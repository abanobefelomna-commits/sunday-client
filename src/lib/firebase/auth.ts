import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebaseClientAuth } from "./client";

/**
 * Email/password helpers for the Firebase Web SDK.
 *
 * These functions only prove identity to Firebase. The application's own
 * session (httpOnly cookies + signed access token) is still minted by the
 * Next.js server after it verifies the Firebase ID token, so authorisation
 * never depends on client-side state.
 */

export class FirebaseAuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FirebaseAuthError";
    this.code = code;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "البريد الإلكتروني غير صالح.",
  "auth/missing-email": "البريد الإلكتروني مطلوب.",
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/invalid-login-credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/wrong-password": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/user-not-found": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/email-already-in-use": "هذا البريد الإلكتروني مسجّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب جديد.",
  "auth/weak-password": "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل مع أرقام وحروف.",
  "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
  "auth/user-disabled": "تم تعطيل هذا الحساب. تواصل مع مسؤول الكنيسة.",
  "auth/operation-not-allowed": "تسجيل الدخول بالبريد الإلكتروني غير مفعّل في Firebase لهذا المشروع.",
  "auth/network-request-failed": "تعذّر الاتصال بخدمة المصادقة. تحقّق من الشبكة وحاول مرة أخرى.",
  "auth/requires-recent-login": "يرجى تسجيل الدخول مرة أخرى لإكمال هذه العملية.",
};

export function firebaseAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";

  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (error instanceof Error && error.message) return error.message;
  return "تعذّر إكمال عملية المصادقة. حاول مرة أخرى.";
}

function toAuthError(error: unknown): FirebaseAuthError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "auth/unknown")
      : "auth/unknown";
  return new FirebaseAuthError(code, firebaseAuthErrorMessage(error));
}

export async function signInWithFirebaseEmail(
  email: string,
  password: string,
): Promise<string> {
  try {
    const credential = await signInWithEmailAndPassword(
      getFirebaseClientAuth(),
      email.trim(),
      password,
    );
    return await credential.user.getIdToken(true);
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function createFirebaseAccount(
  name: string,
  email: string,
  password: string,
): Promise<string> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseClientAuth(),
      email.trim(),
      password,
    );
    const displayName = name.trim();
    if (displayName) {
      await updateProfile(credential.user, { displayName }).catch(() => undefined);
    }
    return await credential.user.getIdToken(true);
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Removes the Firebase account created moments ago when the server refuses the
 * application-level registration (duplicate phone, invalid church code, …).
 * Failures are swallowed: the account is unreachable without a session anyway.
 */
export async function discardFirebaseAccount(): Promise<void> {
  const user = getFirebaseClientAuth().currentUser;
  if (!user) return;
  await deleteUser(user).catch(() => undefined);
}

/**
 * Ask Firebase to send its verification email. Verification state is only ever
 * trusted from the server-verified ID token (`email_verified`), never from this
 * client call.
 */
export async function sendFirebaseEmailVerification(): Promise<void> {
  const user = getFirebaseClientAuth().currentUser;
  if (!user || user.emailVerified) return;
  await sendEmailVerification(user).catch(() => undefined);
}

export async function getFirebaseIdToken(forceRefresh = true): Promise<string | null> {
  const user = getFirebaseClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh).catch(() => null);
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseClientAuth()).catch(() => undefined);
}

/** Subscribe to Firebase auth state; returns the unsubscribe function. */
export function observeFirebaseSession(
  listener: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseClientAuth(), listener);
}
