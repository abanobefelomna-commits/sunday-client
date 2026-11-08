"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import HeroCanvas from "../HeroCanvas";

export default function HeroSection() {
  const fullText = "منصة مدارس الأحد — رعاية وبناء أجيال الكنيسة";
  const [typedText, setTypedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      index++;
      setTypedText(fullText.slice(0, index));
      if (index >= fullText.length) {
        clearInterval(interval);
        setIsTypingDone(true);
      }
    }, 45);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-4 pt-16 pb-20 overflow-hidden">
      {/* Interactive 2D Rigid-Body Physics Canvas Backdrop */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <HeroCanvas />
      </div>

      {/* Hero Central Content */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center pointer-events-none">
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-[#121317]/10 text-xs font-semibold text-[#45474d] shadow-sm backdrop-blur-md mb-8 pointer-events-auto">
          <Sparkles className="w-3.5 h-3.5 text-[#fbbc05]" />
          <span>كنيسة السيدة العذراء مريم — خدمة التربية الكنسية</span>
        </div>

        {/* Dynamic Typewriter Heading */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-[#121317] tracking-tight leading-[1.12] mb-6 min-h-[1.25em]">
          <span>{typedText}</span>
          <span
            className={`inline-block w-1.5 md:w-2 h-9 md:h-14 bg-[#1a73e8] mr-1.5 align-middle rounded-full ${
              isTypingDone ? "animate-pulse" : ""
            }`}
          />
        </h1>

        {/* Subhead Description */}
        <p className="text-base sm:text-xl text-[#45474d] max-w-2xl font-normal leading-relaxed mb-10">
          نظام رقمي موحّد وشامل لرصد الحضور، إدارة الفصول، توثيق الافتقاد المنزلي، ومتابعة نمو أطفالنا في كلمة الله ومحبة الكنيسة بكل يسر وأمان.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3.5 flex-wrap justify-center pointer-events-auto mb-10">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold text-white bg-[#121317] hover:bg-[#1a73e8] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>إنشاء حساب خادم جديد</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center px-7 py-3.5 rounded-full text-sm font-bold text-[#121317] bg-white/90 hover:bg-white border border-[#121317]/15 hover:border-[#121317]/30 transition-all duration-200 shadow-sm backdrop-blur-md"
          >
            تسجيل الدخول
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center text-xs font-semibold text-[#5f6368] pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#34a853]" />
            <span>متاح لجميع المراحل من حضانة لثانوي</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#34a853]" />
            <span>مجاني بالكامل لكنائسنا</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#34a853]" />
            <span>يعمل على الهاتف والكمبيوتر</span>
          </div>
        </div>
      </div>
    </section>
  );
}
