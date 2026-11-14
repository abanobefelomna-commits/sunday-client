"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginUser } from "../lib/api";
import { toast } from "sonner";
import { useI18n } from "../lib/app-i18n";
import { FloatingLabelInput } from "../components/ui/FloatingInput";
import { Languages, Lock, User, ArrowLeft, ArrowRight } from "lucide-react";
import { MotionInView } from "../components/motion";

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
  const { t, locale, setLocale, direction } = useI18n();

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

  const BackIcon = direction === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4 sm:p-6 overflow-hidden">
      {/* Top bar with back link & locale switch */}
      <header className="absolute top-4 sm:top-6 inset-x-4 sm:inset-x-8 z-20 flex items-center justify-between pointer-events-auto">
        <Link
          href="/"
          className="btn ghost sm inline-flex items-center gap-2 backdrop-blur-md bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60"
        >
          <BackIcon className="h-4 w-4" aria-hidden="true" />
          <span>{t("common.backHome")}</span>
        </Link>

        <button
          type="button"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          className="btn ghost sm inline-flex items-center gap-1.5 backdrop-blur-md bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60"
          aria-label={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Languages className="h-4 w-4" aria-hidden="true" />
          <span className="font-semibold text-xs">{locale === "ar" ? "English" : "العربية"}</span>
        </button>
      </header>

      {/* Main Login Card */}
      <MotionInView className="w-full max-w-md z-10 my-auto py-12">
        <div className="auth-card w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-7 sm:p-10 shadow-2xl text-center">
          {/* Logo & Brand Presentation */}
          <div className="mx-auto mb-5 w-fit">
            <div className="relative p-1.5 rounded-2xl bg-gradient-to-tr from-amber-400/25 via-blue-500/25 to-indigo-500/25 shadow-lg shadow-indigo-500/10">
              <div className="auth-mark w-14 h-14 rounded-xl text-white grid place-items-center text-2xl font-bold shadow-md">
                ✝
              </div>
            </div>
            <span className="inline-block mt-2.5 px-3 py-0.5 rounded-full text-xs font-semibold tracking-wide text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60">
              {t("common.appName")}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-1.5">
            {t("login.title")}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-6 font-medium">
            {t("login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="text-start space-y-3">
            <FloatingLabelInput
              id="identifier"
              label={t("login.identifier")}
              type="text"
              required
              autoComplete="username"
              dir="ltr"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              startIcon={<User className="h-4 w-4" />}
            />

            <FloatingLabelInput
              id="password"
              label={t("login.password")}
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              showPasswordToggle={true}
              startIcon={<Lock className="h-4 w-4" />}
            />

            <div className="pt-1 text-end">
              <Link
                href="/forgot-password"
                className="auth-accent-link text-xs sm:text-sm font-semibold hover:underline inline-block transition-colors"
              >
                {t("login.forgot")}
              </Link>
            </div>

            {error && (
              <div
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium text-center"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn big w-full mt-4 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-transform"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  <span>{t("login.submitting")}</span>
                </>
              ) : (
                <span>{t("login.submit")}</span>
              )}
            </button>
          </form>

          {/* Registration link */}
          <p className="mt-6 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t("login.noAccount")}{" "}
            <Link
              href="/register"
              className="auth-accent-link font-bold hover:underline inline-block"
            >
              {t("login.createAccount")}
            </Link>
          </p>

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-5 select-none font-medium">
            {t("login.blessing")}
          </p>
        </div>
      </MotionInView>
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
