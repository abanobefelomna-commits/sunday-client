"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser, ApiError } from "../lib/api";
import {
  passwordPolicyIssue,
  passwordPolicyMessageKey,
} from "../lib/password-policy";
import { toast } from "sonner";
import { User, Mail, Phone, Lock, Languages, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";
import { FloatingLabelInput } from "../components/ui/FloatingInput";
import { MotionInView } from "../components/motion";

const GRADE_OPTIONS: Array<{ value: string; key: AppMessageKey }> = [
  { value: "first", key: "grade.first" },
  { value: "second", key: "grade.second" },
  { value: "third", key: "grade.third" },
  { value: "fourth", key: "grade.fourth" },
  { value: "fifth", key: "grade.fifth" },
  { value: "sixth", key: "grade.sixth" },
  { value: "general", key: "grade.general" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("first");
  const [servantRole, setServantRole] = useState("servant");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [churchName, setChurchName] = useState<string | null>(null);
  const [churchSlug, setChurchSlug] = useState<string | null>(null);
  const [requestedChurchSlug, setRequestedChurchSlug] = useState<string | null>(null);
  const [churchCodeError, setChurchCodeError] = useState<string | null>(null);
  const [churchCodeLoading, setChurchCodeLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, locale, setLocale, direction } = useI18n();

  // Query parameters bootstrap the central join flow after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialSlug = params.get("church")?.trim().toLowerCase() || "";
    if (/^[a-z0-9-]{2,63}$/.test(initialSlug)) setRequestedChurchSlug(initialSlug);
    let initialCode = "";
    try {
      initialCode = window.sessionStorage.getItem("churchJoinCode")?.trim() || "";
      window.sessionStorage.removeItem("churchJoinCode");
    } catch {
      return;
    }
    if (!initialCode) return;

    setChurchCode(initialCode);
    setChurchCodeLoading(true);
    void (async () => {
      try {
        const response = await fetch("/api/auth/church-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: initialCode }),
        });
        const body = await response.json().catch(() => ({})) as {
          church?: { name?: string; slug?: string };
          message?: string;
        };
        if (!response.ok || !body.church?.name || !body.church.slug) {
          throw new Error(body.message || t("register.churchCodeInvalid"));
        }
        if (initialSlug && body.church.slug !== initialSlug) {
          throw new Error("رمز الدعوة لا يخص الكنيسة المحددة");
        }
        setChurchName(body.church.name);
        setChurchSlug(body.church.slug);
        setChurchCode(initialCode.toUpperCase());
      } catch (caught) {
        setChurchCodeError(caught instanceof Error ? caught.message : t("register.churchCodeInvalid"));
      } finally {
        setChurchCodeLoading(false);
      }
    })();
  }, [t]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const validateChurchCode = async () => {
    const trimmed = churchCode.trim();
    if (!trimmed) {
      setChurchCodeError(t("register.churchCodeInvalid"));
      return;
    }
    setChurchCodeLoading(true);
    setChurchCodeError(null);
    setChurchName(null);
    setChurchSlug(null);
    try {
      const response = await fetch("/api/auth/church-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        church?: { name?: string; slug?: string };
        message?: string;
      };
      if (!response.ok || !body.church?.name || !body.church.slug) {
        throw new Error(body.message || t("register.churchCodeInvalid"));
      }
      if (requestedChurchSlug && body.church.slug !== requestedChurchSlug) {
        throw new Error("رمز الدعوة لا يخص الكنيسة المحددة");
      }
      setChurchName(body.church.name);
      setChurchSlug(body.church.slug);
      setChurchCode(trimmed.toUpperCase());
      toast.success(t("register.churchCodeSuccess", { name: body.church.name }));
    } catch (caught) {
      setChurchCodeError(
        caught instanceof Error ? caught.message : t("register.churchCodeInvalid"),
      );
    } finally {
      setChurchCodeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError(t("register.required"));
      toast.error(t("register.requiredToast"));
      return;
    }

    const policyIssue = passwordPolicyIssue(password);
    if (policyIssue) {
      const message = t(passwordPolicyMessageKey(policyIssue) as AppMessageKey);
      setError(message);
      toast.error(message);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      toast.error(t("register.passwordMismatch"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Registration intentionally creates an inactive account and returns no
      // tokens. The account becomes usable only after the emailed code is
      // confirmed on /verify-email, which is also why no avatar is uploaded
      // here: there is no authenticated session yet.
      const result = await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        servantRole: servantRole === "class_leader" ? "class_leader" : "servant",
        grades: [grade],
        churchCode: churchCode.trim() || undefined,
        churchSlug: churchSlug || requestedChurchSlug || undefined,
      });

      const destination = result.email || email.trim().toLowerCase();
      toast.success(t("register.welcome", { name: name.trim() }), {
        description: t("register.welcomeHint", { email: destination }),
      });

      router.push(`/verify-email?email=${encodeURIComponent(destination)}`);
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("register.failed");
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const BackIcon = direction === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="auth-page relative min-h-screen py-16 px-4 grid place-items-center">
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

      <MotionInView className="w-full max-w-lg z-10 my-auto py-8">
        <div className="auth-card w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-7 sm:p-10 shadow-2xl">
          <div className="text-start mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60">
                ✝ {t("common.appName")}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-1 tracking-tight">
              {t("register.title")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              {t("register.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="text-start space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2">
              <label
                htmlFor="churchCode"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                {t("register.churchCode")}
              </label>
              <div className="flex gap-2">
                <input
                  id="churchCode"
                  type="text"
                  value={churchCode}
                  onChange={(event) => {
                    setChurchCode(event.target.value.toUpperCase());
                    setChurchName(null);
                    setChurchSlug(null);
                    setChurchCodeError(null);
                  }}
                  placeholder={t("register.churchCodePlaceholder")}
                  disabled={loading || churchCodeLoading}
                  autoComplete="off"
                  dir="ltr"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 px-3 text-sm font-semibold tracking-wider"
                />
                <button
                  type="button"
                  onClick={validateChurchCode}
                  disabled={churchCodeLoading || loading || !churchCode.trim()}
                  className="btn ghost sm shrink-0"
                >
                  {churchCodeLoading
                    ? t("register.churchCodeChecking")
                    : t("register.churchCodeValidate")}
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("register.churchCodeHint")}
              </p>
              {churchName && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400" role="status">
                  {t("register.churchCodeSuccess", { name: churchName })}
                </p>
              )}
              {churchCodeError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400" role="alert">
                  {churchCodeError}
                </p>
              )}
            </div>

            <FloatingLabelInput
              id="name"
              label={t("register.name")}
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              startIcon={<User className="h-4 w-4" />}
            />

            {/* Role and Grade selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="fld">
                <label htmlFor="servantRole" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("register.role")}
                </label>
                <select
                  id="servantRole"
                  value={servantRole}
                  onChange={(e) => setServantRole(e.target.value)}
                  disabled={loading}
                  className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                >
                  <option value="servant">{t("register.roleServant")}</option>
                  <option value="class_leader">{t("register.roleClassLeader")}</option>
                </select>
              </div>

              <div className="fld">
                <label htmlFor="grade" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("register.grade")}
                </label>
                <select
                  id="grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={loading}
                  className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                >
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.key)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <FloatingLabelInput
              id="email"
              label={t("register.email")}
              type="email"
              required
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              startIcon={<Mail className="h-4 w-4" />}
            />

            <FloatingLabelInput
              id="phone"
              label={t("register.phone")}
              type="tel"
              required
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              startIcon={<Phone className="h-4 w-4" />}
            />

            <FloatingLabelInput
              id="password"
              label={t("register.password")}
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              showPasswordToggle={true}
              startIcon={<Lock className="h-4 w-4" />}
            />

            <FloatingLabelInput
              id="confirmPassword"
              label={t("register.confirmPassword")}
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              showPasswordToggle={true}
              error={
                confirmPassword && password !== confirmPassword
                  ? t("register.passwordMismatch")
                  : null
              }
              startIcon={<Lock className="h-4 w-4" />}
            />

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
                  <span>{t("register.submitting")}</span>
                </>
              ) : (
                <span>{t("register.submit")}</span>
              )}
            </button>

            <p className="hint text-center mt-6 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t("register.haveAccount")}{" "}
              <Link href="/login" className="auth-accent-link font-bold hover:underline">
                {t("register.loginNow")}
              </Link>
            </p>
          </form>
        </div>
      </MotionInView>
    </div>
  );
}
