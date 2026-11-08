"use client";

import Link from "next/link";

export default function MegaFooter() {
  return (
    <footer className="w-full bg-[#121317] text-white pt-20 pb-12 border-t border-white/10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Giant Typographic Brand Banner */}
        <div className="relative py-8 select-none border-b border-white/10 mb-16 overflow-hidden">
          <div className="text-center font-black tracking-tighter text-[clamp(2.8rem,10vw,7.8rem)] text-transparent bg-clip-text bg-gradient-to-b from-white/30 via-white/10 to-transparent leading-none whitespace-nowrap">
            مدارس الأحد ✝
          </div>
          <div className="text-center text-xs sm:text-sm font-bold tracking-widest text-slate-400 uppercase mt-2">
            St. Mary Sunday School Digital Platform
          </div>
        </div>

        {/* Multi-Column Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16 text-right">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
              عن المنصة
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  سجل الحضور السريع
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  نظام الافتقاد الذكي
                </a>
              </li>
              <li>
                <a href="#use-cases" className="hover:text-white transition-colors">
                  لوحة الآباء الكهنة
                </a>
              </li>
              <li>
                <a href="#classes" className="hover:text-white transition-colors">
                  دليل الفصول والمناهج
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
              المراحل والخدمات
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <li>
                <Link href="/classes" className="hover:text-white transition-colors">
                  مرحلة الحضانة والتمهيدي
                </Link>
              </li>
              <li>
                <Link href="/classes" className="hover:text-white transition-colors">
                  المرحلة الابتدائية (١ - ٦)
                </Link>
              </li>
              <li>
                <Link href="/classes" className="hover:text-white transition-colors">
                  المرحلة الإعدادية
                </Link>
              </li>
              <li>
                <Link href="/classes" className="hover:text-white transition-colors">
                  المرحلة الثانوية
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
              الخدام والأنشطة
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <li>
                <Link href="/servants" className="hover:text-white transition-colors">
                  دليل الخدام والخادمات
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white transition-colors">
                  أخبار وأنشطة الكنيسة
                </Link>
              </li>
              <li>
                <a href="#newsletter" className="hover:text-white transition-colors">
                  المناهج والوسائل الإيضاحية
                </a>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  طلب انضمام لأسرة الخدمة
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
              حسابي والأمان
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  تسجيل الدخول
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  إنشاء حساب خادم جديد
                </Link>
              </li>
              <li>
                <Link href="/forgot-password" className="hover:text-white transition-colors">
                  استعادة كلمة المرور
                </Link>
              </li>
              <li>
                <span className="text-slate-500">سياسة الخصوصية والسرية</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © 2026 مدارس الأحد — كنيسة السيدة العذراء مريم. بفضل ربنا يسوع وبقوة صليبه ✝
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-white transition-colors cursor-pointer">
              خدمة التربية الكنسية
            </span>
            <span>•</span>
            <span className="hover:text-white transition-colors cursor-pointer">
              كافة الحقوق محفوظة
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
