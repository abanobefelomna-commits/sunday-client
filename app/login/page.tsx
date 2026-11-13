"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginUser } from "../lib/api";
import { toast } from "sonner";
import { useI18n } from "../lib/app-i18n";

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/login" || value.startsWith("/login?")) return null;
  return value;
}

function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError(t("login.required"));
      toast.error(t("login.requiredToast"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await loginUser(identifier.trim(), password);
      const name = res.user.name || t("login.defaultUser");
      toast.success(t("login.welcome", { name }));
      window.location.href = safeNext(searchParams.get("next")) ?? "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("login.failed");
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4 overflow-hidden">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          {t("common.backHome")}
        </Link>
      </div>

      <div className="auth-card w-full max-w-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
        <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-3xl font-bold">
          ✝
        </div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
          {t("login.title")}
        </h2>
        <p className="hint mb-6 text-slate-500">{t("login.subtitle")}</p>

        <form onSubmit={handleSubmit} className="f text-start">
          <label htmlFor="identifier">{t("login.identifier")}</label>
          <input
            id="identifier"
            type="text"
            required
            autoComplete="username"
            dir="ltr"
            placeholder="example@church.com / 012..."
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={loading}
          />

          <label htmlFor="password">{t("login.password")}</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <div className="mt-2 text-start">
            <Link
              href="/forgot-password"
              className="auth-accent-link text-sm font-semibold hover:underline"
            >
              {t("login.forgot")}
            </Link>
          </div>

          {error && <p className="msg err mt-3 text-center">{error}</p>}

          <button
            type="submit"
            className="btn big w-full mt-6 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>{t("login.submitting")}</span>
              </>
            ) : (
              <span>{t("login.submit")}</span>
            )}
          </button>
        </form>

        <p className="hint mt-6">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="auth-accent-link font-bold">
            {t("login.createAccount")}
          </Link>
        </p>

        <p className="bless text-xs mt-6">{t("login.blessing")}</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page relative min-h-screen grid place-items-center p-4">
          <div className="auth-card w-full max-w-md p-8 sm:p-10" aria-busy="true" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
