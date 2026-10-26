"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPasswordReset } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("أدخل البريد الإلكتروني أولاً.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await requestPasswordReset(normalizedEmail);
      router.push(`/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تعذر طلب كود الاستعادة، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page relative min-h-screen grid place-items-center p-4">
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
        <Link href="/" className="btn ghost sm">
          الرئيسية
        </Link>
        <ThemeToggle />
      </div>

      <div className="auth-card w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-10 text-center z-10">
        <div className="auth-mark w-16 h-16 mx-auto mb-4 rounded-2xl text-white grid place-items-center text-2xl font-bold">
          OTP
        </div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          نسيت كلمة السر؟
        </h1>
        <p className="hint mb-6 text-slate-500">
          اكتب بريدك الإلكتروني المسجل، وسنرسل لك رمز تحقق لمرة واحدة لإعادة تعيين كلمة السر.
        </p>

        <form onSubmit={handleSubmit} className="f text-right">
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            placeholder="example@church.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />

          {error && <p className="msg err mt-3 text-center">{error}</p>}

          <button
            type="submit"
            className="btn big w-full mt-6"
            disabled={loading}
          >
            {loading ? "جارٍ إرسال كود الاستعادة..." : "إرسال كود الاستعادة"}
          </button>
        </form>

        <Link
          href="/login"
          className="auth-accent-link inline-block mt-6 text-sm font-semibold hover:underline"
        >
          العودة لتسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
