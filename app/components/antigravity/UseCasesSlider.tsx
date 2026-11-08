"use client";

import { useState } from "react";
import { UserCheck, Shield, HeartHandshake, ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";

export default function UseCasesSlider() {
  const [activeSlide, setActiveSlide] = useState(0);

  const cases = [
    {
      role: "خادم الفصل",
      subtitle: "رعاية يوم الأحد المباشرة",
      title: "تسجيل حضور أطفالك في ثوانٍ والتفرغ الكامل للدرس والصلاة",
      desc: "ودّع كشوف الورق وضياع الأسماء. رصد الحضور بنقرة واحدة، وتنبيهات فورية بأعياد ميلاد الأطفال، ومتابعة فورية للغائبين مع هواتف أولياء الأمور.",
      tag: "خدام ابتدائي وإعدادي",
      icon: UserCheck,
      color: "#1a73e8",
      highlights: [
        "كشف حضور سريع على الموبايل",
        "سجل هواتف وعناوين الأطفال",
        "تنبيهات أعياد الميلاد الأسبوعية",
      ],
    },
    {
      role: "أمين الخدمة والمساعدون",
      subtitle: "الإدارة والتنسيق العام",
      title: "رؤية متكاملة لجميع الفصول والمراحل بضغطة زر واحدة",
      desc: "متابعة انتظام الخدام، توزيع المناهج، مراقبة نسب الحضور الكلية للكنيسة، وإرسال تنبيهات جماعية لكافة الخدام في ثوانٍ.",
      tag: "أمانة التربية الكنسية",
      icon: Shield,
      color: "#34a853",
      highlights: [
        "إحصاءات شاملة لكافة فصول الكنيسة",
        "متابعة التزام الخدام واجتماعاتهم",
        "تصدير كشوف الحضور والغياب للآباء الكهنة",
      ],
    },
    {
      role: "الآباء الكهنة",
      subtitle: "الرعاية الأبوية والروحية",
      title: "الاطمئنان على كل أسرة وطفل في الكنيسة بكل دقة وسرية",
      desc: "لوحة مخصصة للآباء الكهنة للاطلاع على تقارير الافتقاد، معرفة الأطفال المنقطعين وتوجيه الخدام لافتقادهم، ومتابعة الحالات الخاصة بسرية كاملة.",
      tag: "الآباء الكهنة",
      icon: HeartHandshake,
      color: "#ea4335",
      highlights: [
        "سجل الافتقاد والحالات التي تحتاج زيارة كهنوتية",
        "نسب حضور الكنيسة أسبوعياً وشهرياً",
        "سرية تامة وصلاحيات مخصصة للكهنة فقط",
      ],
    },
  ];

  return (
    <section id="use-cases" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
        <div className="max-w-2xl">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#1a73e8] mb-3 inline-block">
            حالات الخدمة المصممة لكل دور
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-[#121317] tracking-tight">
            مصمم لكل خادم ومسؤول في كنيستنا
          </h2>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-2 mt-6 md:mt-0">
          <button
            onClick={() => setActiveSlide((prev) => (prev > 0 ? prev - 1 : cases.length - 1))}
            className="p-3 rounded-full border border-[#121317]/10 bg-white hover:bg-[#121317]/5 text-[#121317] transition-colors cursor-pointer"
            aria-label="الحالة السابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveSlide((prev) => (prev < cases.length - 1 ? prev + 1 : 0))}
            className="p-3 rounded-full border border-[#121317]/10 bg-white hover:bg-[#121317]/5 text-[#121317] transition-colors cursor-pointer"
            aria-label="الحالة التالية"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Slide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cases.map((item, idx) => {
          const Icon = item.icon;
          const isSelected = activeSlide === idx;

          return (
            <div
              key={item.role}
              onClick={() => setActiveSlide(idx)}
              className={`rounded-3xl p-8 border transition-all duration-300 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? "bg-[#121317] text-white border-transparent shadow-2xl scale-[1.02]"
                  : "bg-[#f8f9fc] hover:bg-white text-[#121317] border-[#121317]/10 hover:shadow-lg"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: isSelected ? "rgba(255,255,255,0.15)" : `${item.color}15`,
                      color: isSelected ? "#ffffff" : item.color,
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                      isSelected
                        ? "bg-white/10 text-white"
                        : "bg-[#121317]/5 text-[#5f6368]"
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>

                <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-75">
                  {item.subtitle}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-4 leading-snug">
                  {item.title}
                </h3>
                <p
                  className={`text-sm leading-relaxed mb-6 ${
                    isSelected ? "text-slate-300" : "text-[#5f6368]"
                  }`}
                >
                  {item.desc}
                </p>
              </div>

              <div className="pt-6 border-t border-black/10 dark:border-white/10 space-y-2">
                {item.highlights.map((h) => (
                  <div key={h} className="flex items-center gap-2 text-xs font-medium">
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-[#34a853]" : "text-[#1a73e8]"
                      }`}
                    />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
