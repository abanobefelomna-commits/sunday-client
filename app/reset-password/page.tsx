"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, resetPassword } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    if (timer <= 0) return;
    const timeout = setTimeout(() => setTimer((current) => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [timer]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (code.length !== 6) {
      setError("كود التحقق يجب أن يتكون من ٦ أرقام.");
      return;
    }
    if (password.length < 8) {
      setError("كلمة السر يجب أن تتكون من ٨ أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا السر غير متطابقتين.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword({
        email: normalizedEmail,
        code,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تعذر تغيير كلمة السر، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending || !email.trim()) return;

    setResending(true);
    setError(null);

    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setTimer(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تعذر إعادة إرسال الكود.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-card w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
      <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-2xl font-bold">
        OTP
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        إعادة تعيين كلمة السر
      </h1>
      <p className="hint mb-6 text-slate-500">
        أدخل رمز التحقق المكوّن من ٦ أرقام والمرسل إلى بريدك الإلكتروني، ثم اختر كلمة سر جديدة.
      </p>

      {success ? (
        <>
          <p className="msg mt-3 text-emerald-600 dark:text-emerald-400">
            تم تغيير كلمة السر بنجاح. يمكنك تسجيل الدخول الآن.
          </p>
          <Link href="/login" className="btn big w-full mt-6 inline-block">
            تسجيل الدخول
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="f text-right">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="code">كود الاستعادة (٦ أرقام)</label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            dir="ltr"
            placeholder="000000"
            className="text-center text-3xl tracking-widest font-mono font-bold"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            disabled={loading}
          />

          <label htmlFor="password">كلمة السر الجديدة (٨ أحرف على الأقل)</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />

          <label htmlFor="confirmPassword">تأكيد كلمة السر الجديدة</label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
          />

          {error && <p className="msg err mt-3 text-center">{error}</p>}

          <button
            type="submit"
            className="btn big w-full mt-6"
            disabled={loading || code.length !== 6}
          >
            {loading ? "جارٍ تغيير كلمة السر..." : "حفظ كلمة السر الجديدة"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={timer > 0 || resending || !email.trim()}
            className="auth-accent-link w-full mt-4 text-sm font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resending
              ? "جارٍ إعادة الإرسال..."
              : timer > 0
                ? `إعادة إرسال الكود خلال (${timer}ث)`
                : "إعادة إرسال الكود"}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="inline-block mt-6 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          الرئيسية
        </Link>
        <ThemeToggle />
      </div>

      <Suspense fallback={<div className="text-center py-10">جارٍ التحميل...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
