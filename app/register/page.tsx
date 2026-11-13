"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { registerUser, uploadUserAvatar } from "../lib/api";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

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
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      setError(t("register.required"));
      toast.error(t("register.requiredToast"));
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

      // Upload the avatar automatically when one was selected.
      if (selectedFile && authData?.user?.id) {
        try {
          await uploadUserAvatar(authData.user.id, selectedFile);
        } catch {
          // The avatar can be changed later from the profile page.
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

  return (
    <div className="auth-page relative min-h-screen py-16 px-4 grid place-items-center">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          {t("common.backHome")}
        </Link>
      </div>

      <div className="auth-card w-full max-w-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 z-10 shadow-2xl">
        <div className="text-start mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            {t("register.title")}
          </h2>
          <p className="hint text-slate-500">{t("register.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="f text-start">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer bg-slate-50 dark:bg-slate-800/60 hover:border-blue-500 transition shadow-inner"
              >
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt={t("register.photoPreview")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition">
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

          <label htmlFor="name">{t("register.name")}</label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            placeholder={t("register.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <label htmlFor="servantRole">{t("register.role")}</label>
          <select
            id="servantRole"
            value={servantRole}
            onChange={(e) => setServantRole(e.target.value)}
            disabled={loading}
          >
            <option value="servant">{t("register.roleServant")}</option>
            <option value="class_leader">{t("register.roleClassLeader")}</option>
            <option value="admin">{t("register.roleAdmin")}</option>
            <option value="priest">{t("register.rolePriest")}</option>
          </select>

          {!["admin", "priest"].includes(servantRole) && (
            <>
              <label htmlFor="grade">{t("register.grade")}</label>
              <select
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={loading}
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.key)}
                  </option>
                ))}
              </select>
            </>
          )}

          <label htmlFor="email">{t("register.email")}</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            placeholder="servant@church.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <label htmlFor="phone">{t("register.phone")}</label>
          <input
            id="phone"
            type="tel"
            required
            autoComplete="tel"
            dir="ltr"
            placeholder="01000000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />

          <label htmlFor="password">{t("register.password")}</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          {error && <p className="msg err mt-3">{error}</p>}

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
                <span>{t("register.submitting")}</span>
              </>
            ) : (
              <span>{t("register.submit")}</span>
            )}
          </button>

          <p className="hint text-center mt-6">
            {t("register.haveAccount")}{" "}
            <Link href="/login" className="auth-accent-link font-bold">
              {t("register.loginNow")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
