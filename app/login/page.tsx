"use client";

import { useState } from "react";
import Link from "next/link";
import { loginUser } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";
import { toast } from "sonner";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("يرجى إدخال البريد الإلكتروني أو رقم الهاتف وكلمة السر.");
      toast.error("يرجى إدخال بيانات الدخول كاملة.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await loginUser(identifier.trim(), password);
      toast.success(`أهلاً بك يا ${res.user.name || "خادم المسيح"}! تم تسجيل الدخول بنجاح ✝`);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "بيانات الدخول غير صحيحة، حاول مجدداً";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4 overflow-hidden">
      {/* Top right theme toggle & back link */}
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          الرئيسية
        </Link>
        <ThemeToggle />
      </div>

      <div className="auth-card w-full max-w-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
        <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-3xl font-bold">
          ✝
        </div>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
          أهلاً بيك
        </h2>
        <p className="hint mb-6 text-slate-500">دخول الخدام والمشرفين</p>

        <form onSubmit={handleSubmit} className="f text-right">
          <label htmlFor="identifier">اسم المستخدم / البريد / الهاتف</label>
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

          <label htmlFor="password">كلمة السر</label>
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

          <div className="mt-2 text-left">
            <Link
              href="/forgot-password"
              className="auth-accent-link text-sm font-semibold hover:underline"
            >
              نسيت كلمة السر؟
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
                <span>جارٍ التحقق...</span>
              </>
            ) : (
              <span>دخول</span>
            )}
          </button>
        </form>

        <p className="hint mt-6">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="auth-accent-link font-bold">
            أنشئ حساب خادم جديد
          </Link>
        </p>

        <p className="bless text-xs mt-6">بفضل ربنا يسوع وبقوة صليبه ✝</p>
      </div>
    </div>
  );
}
