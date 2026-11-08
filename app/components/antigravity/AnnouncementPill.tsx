"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";

export default function AnnouncementPill() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="w-full flex justify-center px-4 pt-3 pb-1 z-40 relative">
      <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs md:text-sm font-medium bg-[#121317]/[0.03] hover:bg-[#121317]/[0.06] border border-[#121317]/10 text-[#212226] shadow-sm transition-all duration-200 backdrop-blur-md group">
        <span className="bg-[#1a73e8] text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
          جديد
        </span>
        <span className="text-[#212226] font-medium hidden sm:inline">
          إطلاق نظام الافتقاد الذكي وسجل الحضور السريع لعام 2026/2027
        </span>
        <span className="text-[#212226] font-medium sm:hidden">
          نظام الافتقاد الذكي لعام 2026/2027
        </span>
        <a
          href="#features"
          className="inline-flex items-center gap-1 text-[#1a73e8] font-semibold hover:underline mr-1"
        >
          <span>استكشف النظام</span>
          <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#5f6368] hover:text-[#121317] p-0.5 rounded-full hover:bg-black/5 transition-colors mr-1"
          aria-label="إغلاق التنبيه"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
