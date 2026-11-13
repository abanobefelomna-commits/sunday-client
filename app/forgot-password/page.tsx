"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "../lib/api";
import { useI18n } from "../lib/app-i18n";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(t("forgot.required"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestPasswordReset(normalizedEmail);
      router.push(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("forgot.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          {t("common.backHome")}
        </Link>
      </div>

      <div className="auth-card w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
        <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-2xl font-bold">
          OTP
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          {t("forgot.title")}
        </h1>
        <p className="hint mb-6 text-slate-500">{t("forgot.subtitle")}</p>

        <form onSubmit={handleSubmit} className="f text-start">
          <label htmlFor="email">{t("auth.email")}</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          {error && <p className="msg err mt-3 text-center">{error}</p>}

          <button type="submit" className="btn big w-full mt-6" disabled={loading}>
            {loading ? t("auth.sending") : t("auth.sendCode")}
          </button>
        </form>

        <Link
          href="/login"
          className="auth-accent-link inline-block mt-6 text-sm font-semibold hover:underline"
        >
          {t("auth.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
