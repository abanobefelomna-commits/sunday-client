"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { registerUser, uploadUserAvatar } from "../lib/api";
import { toast } from "sonner";
import { Camera, X, User, Mail, Phone, Lock, Languages, ArrowLeft, ArrowRight } from "lucide-react";
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
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("first");
  const [servantRole, setServantRole] = useState("servant");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, locale, setLocale, direction } = useI18n();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("register.photoTooLarge"));
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setError(t("register.required"));
      toast.error(t("register.requiredToast"));
      return;
    }

    if (password.length < 8) {
      setError(t("register.passwordMin"));
      toast.error(t("register.passwordMin"));
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      toast.error(t("register.passwordMismatch"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const authData = await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        servantRole,
        grades: ["admin", "priest"].includes(servantRole) ? [] : [grade],
      });

      // Upload avatar if selected
      if (selectedFile && authData?.user?.id) {
        try {
          await uploadUserAvatar(authData.user.id, selectedFile);
        } catch {
          // Avatar upload failure is non-fatal
        }
      }

      toast.success(t("register.welcome", { name: name.trim() }), {
        description: t("register.welcomeHint"),
      });

      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("register.failed");
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
            {/* Avatar upload */}
            <div className="flex flex-col items-center justify-center pb-2">
              <div className="relative group">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer bg-slate-50 dark:bg-slate-800/60 hover:border-indigo-500 transition shadow-inner"
                >
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt={t("register.photoPreview")}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-500 transition">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[11px] font-medium">{t("register.photo")}</span>
                    </div>
                  )}
                </div>

                {filePreview && (
                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition"
                    title={t("register.removePhoto")}
                    aria-label={t("register.removePhoto")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <span className="text-xs text-slate-400 mt-2">{t("register.photoHint")}</span>
            </div>

            {/* Floating label inputs */}
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
                  <option value="admin">{t("register.roleAdmin")}</option>
                  <option value="priest">{t("register.rolePriest")}</option>
                </select>
              </div>

              {!["admin", "priest"].includes(servantRole) && (
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
              )}
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
