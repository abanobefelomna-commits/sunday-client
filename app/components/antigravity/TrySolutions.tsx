"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles, Building2, UserPlus } from "lucide-react";

export default function TrySolutions() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: For Individual Servants */}
        <div className="relative rounded-3xl p-8 sm:p-12 border border-[#121317]/10 bg-[#f8f9fc] hover:bg-white transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col justify-between group">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1a73e8]/10 text-[#1a73e8] text-xs font-bold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>متاح مجاناً لكافة الخدام</span>
            </div>

            <div className="text-xs font-bold uppercase tracking-wider text-[#5f6368] mb-1">
              للخدام والخادمات
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-[#121317] tracking-tight mb-4">
              ابدأ إدارة فصلك وسجل حضورك اليوم
            </h3>
            <p className="text-sm sm:text-base text-[#5f6368] leading-relaxed mb-8">
              أنشئ حساب خادم جديد في أقل من دقيقة، وحدد مرحلتك الدراسية وفصلك، وابدأ فوراً رصد الحضور والافتقاد الأسبوعي.
            </p>
          </div>

          <div>
            <Link
              href="/register"
              className="inline-flex items-center justify-between w-full sm:w-auto gap-4 px-8 py-4 rounded-full text-sm font-bold text-white bg-[#121317] hover:bg-[#1a73e8] transition-all duration-200 shadow-md group-hover:shadow-lg"
            >
              <span>إنشاء حساب خادم جديد</span>
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            </Link>
            <span className="block text-xs font-semibold text-[#5f6368] mt-3">
              متاح الآن لجميع الخدام ✓
            </span>
          </div>
        </div>

        {/* Card 2: For Church Superintendents & Priests */}
        <div className="relative rounded-3xl p-8 sm:p-12 border border-[#121317]/10 bg-[#121317] text-white transition-all duration-300 shadow-xl flex flex-col justify-between group overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#34a853]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-bold mb-6 border border-white/10">
              <Building2 className="w-3.5 h-3.5" />
              <span>لأمانة الخدمة والآباء الكهنة</span>
            </div>

            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              تفعيل المنصة للكنيسة
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              ارتقِ بمنظومة الخدمة في كنيستك بالكامل
            </h3>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
              نوفر لك إعداداً كاملاً لكافة المراحل والفصول، مع تدريب الخدام وتصدير الكشوف الأسبوعية للآباء الكهنة بصيغ منظمة.
            </p>
          </div>

          <div className="relative z-10">
            <a
              href="#newsletter"
              className="inline-flex items-center justify-between w-full sm:w-auto gap-4 px-8 py-4 rounded-full text-sm font-bold text-[#121317] bg-white hover:bg-slate-100 transition-all duration-200 shadow-md"
            >
              <span>طلب تفعيل الخدمة لكنيستك</span>
              <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            </a>
            <span className="block text-xs font-semibold text-slate-400 mt-3">
              تفعيل سريع ودعم كامل لأمناء الخدمة
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
