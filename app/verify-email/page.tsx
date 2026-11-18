"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  resendVerificationEmail,
  verifyEmail,
} from "../lib/api";
import { toast } from "sonner";
import { useI18n } from "../lib/app-i18n";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(60);
  const { t } = useI18n();

  useEffect(() => {
    if (timer <= 0) return;
    const timeout = setTimeout(() => setTimer((current) => current - 1), 1000);
    return () => clearTimeout(timeout);
  }, [timer]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(t("verify.requiredEmail"));
      return;
    }
    if (code.length !== 6) {
      setError(t("verify.codeLength"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await verifyEmail(normalizedEmail, code);
      setSuccess(true);
      toast.success(t("verify.success", { name: result.user.name }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("verify.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (timer > 0 || resending || !normalizedEmail) return;

    setResending(true);
    setError(null);

    try {
      await resendVerificationEmail(normalizedEmail);
      setTimer(60);
      toast.success(t("verify.resendSuccess"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("verify.resendFailed"));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-card w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
      <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-2xl font-bold">
        ✉
      </div>
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        {t("verify.title")}
      </h1>
      <p className="hint mb-6 text-slate-500">{t("verify.subtitle")}</p>

      {success ? (
        <>
          <p className="msg mt-3 text-emerald-600 dark:text-emerald-400">
            {t("verify.successNoName")}
          </p>
          <Link href="/dashboard" className="btn big w-full mt-6 inline-block">
            {t("verify.continue")}
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="f text-start">
          <label htmlFor="email">{t("verify.email")}</label>
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

          <label htmlFor="code">{t("verify.codeLabel")}</label>
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

          {error && <p className="msg err mt-3 text-center">{error}</p>}

          <button
            type="submit"
            className="btn big w-full mt-6"
            disabled={loading || code.length !== 6}
          >
            {loading ? t("verify.submitting") : t("verify.submit")}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={timer > 0 || resending || !email.trim()}
            className="auth-accent-link w-full mt-4 text-sm font-semibold hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {resending
              ? t("verify.resending")
              : timer > 0
                ? t("verify.resendIn", { seconds: timer })
                : t("verify.resend")}
          </button>
        </form>
      )}

      <Link
        href="/login"
        className="inline-block mt-6 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        {t("auth.backToLogin")}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useI18n();

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          {t("common.backHome")}
        </Link>
      </div>

      <Suspense fallback={<div className="text-center py-10">{t("common.loading")}</div>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
