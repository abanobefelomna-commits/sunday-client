"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import CommandPalette from "./CommandPalette";
import { getStoredUser, clearStoredAuth, type AuthUser } from "../lib/api";

export default function AppHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    router.push("/login");
  };

  const initial = user?.name ? user.name.replace(/^أ\. /, "").trim().charAt(0) : "✝";

  return (
    <>
      <header className="ab">
        <Link href="/dashboard" className="abb">
          <span className="lg2">✝</span>
          <span>مدارس الأحد</span>
        </Link>

        <div className="tu">
          <button
            type="button"
            className="ib"
            onClick={() => setPaletteOpen(true)}
            aria-label="بحث سريع"
            title="بحث سريع (Ctrl+K)"
          >
            🔍
          </button>

          <ThemeToggle />

          <div className="relative">
            <button
              type="button"
              className="av"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="حسابي"
            >
              {initial}
            </button>

            {menuOpen && (
              <div
                className="absolute left-0 top-12 z-50 min-w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xl flex flex-col gap-2"
                onClick={() => setMenuOpen(false)}
              >
                <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800">
                  <b className="block text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name || "خادم"}</b>
                  <small className="text-xs text-slate-500">{user?.role || "مستخدم"}</small>
                </div>

                <Link
                  href="/dashboard"
                  className="px-2 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  لوحة التحكم
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn ghost sm w-full text-red-500 hover:text-red-600 dark:text-red-400"
                >
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
