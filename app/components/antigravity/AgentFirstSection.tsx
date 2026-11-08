"use client";

import { Check, Heart, BookOpen, Bell, BarChart3, Cross } from "lucide-react";

export default function AgentFirstSection() {
  return (
    <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      {/* Ambient background particles */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-r from-[#4285f4]/5 via-[#ea4335]/5 to-[#34a853]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Kinetic Badges Orbiting */}
      <div className="relative max-w-5xl mx-auto text-center">
        {/* Floating pill 1 */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#121317]/10 text-xs font-bold text-[#1a73e8] shadow-md backdrop-blur-md absolute -top-8 right-8 animate-bounce [animation-duration:4s]">
          <Check className="w-3.5 h-3.5 text-[#34a853]" />
          <span>رصد الحضور بنقرة واحدة</span>
        </div>

        {/* Floating pill 2 */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#121317]/10 text-xs font-bold text-[#ea4335] shadow-md backdrop-blur-md absolute top-12 left-6 animate-pulse [animation-duration:3.2s]">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span>سجل الافتقاد والرعاية</span>
        </div>

        {/* Floating pill 3 */}
        <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#121317]/10 text-xs font-bold text-[#fbbc05] shadow-md backdrop-blur-md absolute -bottom-6 right-20 animate-bounce [animation-duration:5s]">
          <BookOpen className="w-3.5 h-3.5 text-[#121317]" />
          <span>مناهج التربية الكنسية</span>
        </div>

        {/* Floating pill 4 */}
        <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#121317]/10 text-xs font-bold text-[#34a853] shadow-md backdrop-blur-md absolute -bottom-10 left-16 animate-pulse [animation-duration:4.5s]">
          <BarChart3 className="w-3.5 h-3.5 text-[#34a853]" />
          <span>تقارير شاملة لأمانة الخدمة والكهنة</span>
        </div>

        {/* Eyebrow */}
        <span className="text-xs font-extrabold uppercase tracking-widest text-[#1a73e8] mb-6 inline-block">
          رسالتنا في التربية الكنسية
        </span>

        {/* Giant Typographic Statement */}
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-[#121317] tracking-tight leading-[1.25] max-w-4xl mx-auto mb-8">
          مدارس الأحد ليست مجرد لقاء أسبوعي، بل{" "}
          <span className="bg-gradient-to-r from-[#1a73e8] via-[#ea4335] to-[#fbbc05] bg-clip-text text-transparent">
            رحلة بناء روحي
          </span>{" "}
          ورعاية لكل طفل بأمانة واهتمام واحترافية.
        </h2>

        <p className="text-base sm:text-xl text-[#5f6368] max-w-2xl mx-auto font-medium leading-relaxed">
          نجمع بين عراقة التعاليم الكنسية وأحدث أدوات التنظيم الرقمي، لنمنح الخدام بيئة هادئة ومثمرة للتركيز على الخدمة الحقيقية وخلاص النفوس.
        </p>
      </div>
    </section>
  );
}
