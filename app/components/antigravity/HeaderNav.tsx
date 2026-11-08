"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getStoredToken } from "../../lib/api";
import { Menu, X, Rocket, ChevronDown } from "lucide-react";

export default function HeaderNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());
    const onScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? "bg-white/85 backdrop-blur-xl border-b border-[#121317]/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] py-2.5"
          : "bg-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#121317] flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform duration-200 group-hover:scale-105">
            ✝
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-[#121317] tracking-tight text-lg leading-tight">
              مدارس الأحد
            </span>
            <span className="text-[11px] text-[#5f6368] font-medium leading-none">
              كنيسة السيدة العذراء مريم
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#121317]/[0.04] p-1.5 rounded-full border border-[#121317]/[0.06] backdrop-blur-md">
          <a
            href="#features"
            className="px-4 py-1.5 text-xs font-semibold text-[#45474d] hover:text-[#121317] hover:bg-white rounded-full transition-all duration-150"
          >
            الميزات
          </a>
          <a
            href="#use-cases"
            className="px-4 py-1.5 text-xs font-semibold text-[#45474d] hover:text-[#121317] hover:bg-white rounded-full transition-all duration-150"
          >
            حالات الخدمة
          </a>
          <a
            href="#classes"
            className="px-4 py-1.5 text-xs font-semibold text-[#45474d] hover:text-[#121317] hover:bg-white rounded-full transition-all duration-150"
          >
            المراحل والفصول
          </a>
          <a
            href="#insights"
            className="px-4 py-1.5 text-xs font-semibold text-[#45474d] hover:text-[#121317] hover:bg-white rounded-full transition-all duration-150"
          >
            المقالات والمناهج
          </a>
          <a
            href="#newsletter"
            className="px-4 py-1.5 text-xs font-semibold text-[#45474d] hover:text-[#121317] hover:bg-white rounded-full transition-all duration-150"
          >
            النشرة
          </a>
        </nav>

        {/* Action Controls */}
        <div className="hidden sm:flex items-center gap-2.5">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold text-white bg-[#121317] hover:bg-[#1a73e8] transition-all duration-200 shadow-sm hover:shadow"
            >
              <span>لوحة التحكم</span>
              <Rocket className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-full text-xs font-bold text-[#212226] hover:bg-black/5 transition-all duration-150"
              >
                تسجيل الدخول
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold text-white bg-[#121317] hover:bg-[#1a73e8] transition-all duration-200 shadow-sm hover:shadow"
              >
                <span>حساب خادم جديد</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-[#212226] rounded-xl hover:bg-black/5 transition-colors"
          aria-label="القائمة"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-2xl border-b border-[#121317]/10 px-6 py-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-2">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-semibold text-[#212226] hover:bg-black/5 rounded-lg"
            >
              الميزات
            </a>
            <a
              href="#use-cases"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-semibold text-[#212226] hover:bg-black/5 rounded-lg"
            >
              حالات الخدمة
            </a>
            <a
              href="#classes"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-semibold text-[#212226] hover:bg-black/5 rounded-lg"
            >
              المراحل والفصول
            </a>
            <a
              href="#insights"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-semibold text-[#212226] hover:bg-black/5 rounded-lg"
            >
              المقالات والمناهج
            </a>
            <a
              href="#newsletter"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm font-semibold text-[#212226] hover:bg-black/5 rounded-lg"
            >
              النشرة الدورية
            </a>
          </nav>
          <div className="pt-4 border-t border-black/10 flex flex-col gap-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-full text-xs font-bold text-white bg-[#121317]"
              >
                افتح لوحة التحكم
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full text-xs font-bold text-[#212226] border border-black/15"
                >
                  تسجيل الدخول
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-full text-xs font-bold text-white bg-[#121317]"
                >
                  حساب خادم جديد
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
