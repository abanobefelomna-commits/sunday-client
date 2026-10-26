"use client";

import { useState } from "react";
import Link from "next/link";
import { registerUser } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

const GRADES = [
  { value: "first", label: "سنة أولى ابتدائي" },
  { value: "second", label: "سنة ثانية ابتدائي" },
  { value: "third", label: "سنة ثالثة ابتدائي" },
  { value: "fourth", label: "سنة رابعة ابتدائي" },
  { value: "fifth", label: "سنة خامسة ابتدائي" },
  { value: "sixth", label: "سنة سادسة ابتدائي" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("first");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim() || password.length < 8) {
      setError("يرجى ملء جميع الحقول وكلمة السر ٨ أحرف على الأقل.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role: "servant",
        grades: [grade],
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل إنشاء الحساب، يرجى المحاولة لاحقاً";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen py-16 px-4 grid place-items-center">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          الرئيسية
        </Link>
        <ThemeToggle />
      </div>

      <div className="auth-card w-full max-w-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 z-10">
        <div className="text-right mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            حساب خادم جديد
          </h2>
          <p className="hint text-slate-500">
            للخدام والمشرفين فقط. الأطفال يتم تسجيلهم داخل التطبيق.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="f text-right">
          <label htmlFor="name">الاسم الكامل</label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            placeholder="مثال: أ. مينا سامي"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <label htmlFor="grade">المرحلة أو الفصل الذي تخدم به</label>
          <select
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            disabled={loading}
          >
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          <label htmlFor="email">البريد الإلكتروني</label>
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

          <label htmlFor="phone">رقم الموبايل</label>
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

          <label htmlFor="password">كلمة السر (٨ أحرف على الأقل)</label>
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
          {success && (
            <p className="msg mt-3 text-center text-emerald-600 dark:text-emerald-400">
              تم إنشاء الحساب بنجاح. يمكنك تسجيل الدخول الآن.
            </p>
          )}

          <button
            type="submit"
            className="btn big w-full mt-6 flex items-center justify-center gap-2"
            disabled={loading || success}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>جارٍ إنشاء الحساب...</span>
              </>
            ) : success ? (
              <span>تم إنشاء الحساب</span>
            ) : (
              <span>إنشاء الحساب</span>
            )}
          </button>

          <p className="hint text-center mt-6">
            {success ? "لديك حساب الآن؟ " : "لديك حساب بالفعل؟ "}
            <Link href="/login" className="auth-accent-link font-bold">
              سجّل دخولك الآن
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
