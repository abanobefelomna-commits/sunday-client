"use client";

import Link from "next/link";
import { ArrowLeft, Monitor, Smartphone, Tablet, Globe, Sparkles } from "lucide-react";

export default function DownloadSection() {
  return (
    <section id="classes" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="relative rounded-3xl overflow-hidden bg-[#121317] text-white p-8 sm:p-16 border border-white/10 shadow-2xl text-center">
        {/* Glow lights */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#4285f4]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#34a853]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 backdrop-blur-md mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbc05]" />
            <span>خدمة مدارس الأحد في ثوبها الرقمي الجديد</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-6 leading-tight">
            ابدأ تنظيم فصلك ومتابعة أطفالك اليوم بكل سهولة
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mb-10 leading-relaxed">
            المنصة سريعة، متجاوبة، وتعمل مباشرة من أي جهاز تمتلكه بدون الحاجة لتنزيل برامج معقدة.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-bold text-[#121317] bg-white hover:bg-slate-100 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>إنشاء حساب خادم جديد</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center px-8 py-4 rounded-full text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all duration-200 backdrop-blur-md"
            >
              تسجيل الدخول
            </Link>
          </div>

          {/* Supported Devices Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium pt-8 border-t border-white/10 w-full">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#4285f4]" />
              <span>متصفح الويب المباشر</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#34a853]" />
              <span>هواتف آيفون وأندرويد</span>
            </div>
            <div className="flex items-center gap-2">
              <Tablet className="w-4 h-4 text-[#fbbc05]" />
              <span>أجهزة الآيباد والتابلت</span>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#ea4335]" />
              <span>أجهزة الكمبيوتر واللابتوب</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
