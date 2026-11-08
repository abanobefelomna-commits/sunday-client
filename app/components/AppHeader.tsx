"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Moon,
  Newspaper,
  Search,
  Sun,
  User,
  Users,
  Baby,
} from "lucide-react";
import CommandPalette from "./CommandPalette";
import {
  getStoredUser,
  clearStoredAuth,
  getImageUrl,
  getNotifications,
  type AuthUser,
} from "../lib/api";

const MENU_LINKS = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/children", label: "الأطفال", icon: Baby },
  { href: "/attendance", label: "الحضور", icon: CalendarCheck },
  { href: "/follow-ups", label: "المتابعات الرعوية", icon: HeartHandshake },
  { href: "/analytics", label: "التحليلات", icon: BarChart3 },
  { href: "/classes", label: "الفصول", icon: BookOpen },
  { href: "/servants", label: "الخدام", icon: Users },
  { href: "/friday-prep", label: "تحضير الجمعة", icon: ClipboardCheck },
  { href: "/news", label: "الأخبار", icon: Newspaper },
];

export default function AppHeader() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setUser(getStoredUser());
    const storedTheme = localStorage.getItem("ss_theme");
    const initial =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const loadUnread = useCallback(() => {
    getNotifications({ limit: 1 })
      .then((res) => setUnread(res.meta.unread))
      .catch(() => setUnread(0));
  }, []);

  useEffect(() => {
    loadUnread();
    const interval = window.setInterval(loadUnread, 60_000);
    return () => window.clearInterval(interval);
  }, [loadUnread, pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ss_theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = () => {
    clearStoredAuth();
    router.push("/login");
  };

  const initial = user?.name ? user.name.replace(/^أ\. /, "").trim().charAt(0) : "✝";
  const roleLabel =
    user?.role === "admin" || user?.servantRole === "مسؤول"
      ? "مسؤول خدمة"
      : user?.role === "priest" || user?.servantRole === "أب كاهن"
        ? "أب كاهن"
        : "خادم";

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
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
            title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            className="ib"
            onClick={() => setPaletteOpen(true)}
            aria-label="بحث سريع"
            title="بحث سريع (Ctrl+K)"
          >
            <Search className="h-4 w-4" />
          </button>

          <Link
            href="/notifications"
            className="ib relative"
            aria-label={unread > 0 ? `التنبيهات، ${unread} غير مقروء` : "التنبيهات"}
            title="التنبيهات"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  insetBlockStart: -3,
                  insetInlineEnd: -3,
                  minWidth: 17,
                  height: 17,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                  lineHeight: 1,
                }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <div className="relative">
            <button
              type="button"
              className="av overflow-hidden flex items-center justify-center p-0"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="حسابي"
              aria-expanded={menuOpen}
            >
              {user?.avatar ? (
                <img
                  src={getImageUrl(user.avatar)}
                  alt={user.name}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span>{initial}</span>
              )}
            </button>

            {menuOpen && (
              <div
                className="absolute left-0 top-12 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl flex flex-col gap-1"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <b className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {user?.name || "خادم"}
                  </b>
                  <small className="text-xs text-slate-500">{roleLabel}</small>
                </div>

                <div className="grid grid-cols-1 gap-0.5 max-h-[52vh] overflow-y-auto">
                  {MENU_LINKS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className="px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                      >
                        <Icon className="h-4 w-4 opacity-70" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 grid gap-0.5">
                  <Link
                    href="/profile"
                    role="menuitem"
                    className="px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-2.5 text-slate-700 dark:text-slate-200"
                  >
                    <User className="h-4 w-4 opacity-70" aria-hidden="true" />
                    <span>الملف الشخصي</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-2 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center gap-2.5 text-red-600 dark:text-red-400 text-start"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
