"use client";

import { useState } from "react";
import { Play, X, Sparkles, Check, Users, CalendarCheck, ShieldCheck } from "lucide-react";

export default function VideoShowcase() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 mb-28 z-20">
      {/* Video / Preview Card */}
      <div className="relative rounded-3xl overflow-hidden border border-[#121317]/10 bg-[#121317] text-white shadow-2xl transition-all duration-300 hover:shadow-[0_24px_50px_rgba(0,0,0,0.18)] group">
        {/* Subtle decorative mesh / background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#121317] via-[#1c1e24] to-[#262b38] opacity-90" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#4285f4]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#34a853]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative p-6 sm:p-12 lg:p-16 flex flex-col items-center text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 backdrop-blur-md mb-6">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbc05]" />
            <span>شاهد ديمو حي للمنصة في دقيقة واحدة</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-4 max-w-2xl leading-snug">
            كيف يدير الخادم فصول مدارس الأحد والافتقاد بسلاسة رقمية فائقة؟
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mb-10 leading-relaxed">
            استكشف واجهة تسجيل الحضور السريعة، إحصاءات الغياب التلقائية، وجداول الزيارات المنزلية المصممة خصيصاً لخدمة كنيستنا.
          </p>

          {/* Interactive Play Trigger */}
          <button
            onClick={() => setModalOpen(true)}
            className="relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white text-[#121317] hover:scale-110 active:scale-95 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.45)] group/btn cursor-pointer"
            aria-label="تشغيل فيديو العرض التوضيحي"
          >
            <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-25 pointer-events-none" />
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current translate-x-[-1px] group-hover/btn:text-[#1a73e8] transition-colors" />
          </button>

          <span className="text-xs text-slate-400 font-semibold mt-4">
            مدة العرض: دقيقة و١٥ ثانية • جولة تفاعلية
          </span>

          {/* Feature Highlight Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl mt-12 pt-10 border-t border-white/10 text-right">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04]">
              <div className="p-2 rounded-xl bg-[#4285f4]/20 text-[#4285f4] shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">رصد حضور بضغطة زر</h3>
                <p className="text-xs text-slate-400">دوس حاضر أو غايب بدون أوراق أو تعقيد</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04]">
              <div className="p-2 rounded-xl bg-[#34a853]/20 text-[#34a853] shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">سجل افتقاد ذكي</h3>
                <p className="text-xs text-slate-400">تنبيهات فورية بالأطفال المتغيبين أكثر من أسبوع</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04]">
              <div className="p-2 rounded-xl bg-[#fbbc05]/20 text-[#fbbc05] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-0.5">حماية وسرية تامة</h3>
                <p className="text-xs text-slate-400">صلاحيات محددة للخدام وأمانة الخدمة والكهنة</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-[#121317] rounded-3xl overflow-hidden border border-white/10 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ea4335]" />
                <div className="w-3 h-3 rounded-full bg-[#fbbc05]" />
                <div className="w-3 h-3 rounded-full bg-[#34a853]" />
                <span className="text-xs font-semibold text-slate-300 mr-2">
                  جولة تفاعلية داخل تطبيق مدارس الأحد
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Live Product Walkthrough */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-[#4285f4] uppercase">١. واجهة كشف الحضور</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.04]">
                      <span>مينا جورج (سنة ثالثة)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">حاضر ✓</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.04]">
                      <span>مريم سمير (سنة ثالثة)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">حاضر ✓</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-white/[0.04]">
                      <span>كيرلس مجدي (سنة ثالثة)</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">غايب — يحتاج اتصال</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-[#34a853] uppercase">٢. سجل الافتقاد المنزلي</span>
                  <div className="space-y-2 text-xs text-slate-300">
                    <p className="p-2.5 rounded-lg bg-white/[0.04]">
                      تمت زيارة منزل الطفل بيشوي عادل والاطمئنان على الأسرة وتوصيل كتيب المسابقة الروحية.
                    </p>
                    <div className="flex justify-between text-[11px] text-slate-400 px-1">
                      <span>الخادم: أ. يوسف إبراهيم</span>
                      <span>الأحد الماضي</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1a73e8]/20 to-[#34a853]/20 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-right">
                  <h4 className="text-sm font-bold text-white">هل أنت مستعد لتجربة المنصة في فصلك؟</h4>
                  <p className="text-xs text-slate-300">التسجيل لا يتطلب سوى دقيقة واحدة لتفعيل حسابك كخادم.</p>
                </div>
                <a
                  href="/register"
                  className="px-6 py-2.5 rounded-full text-xs font-bold text-[#121317] bg-white hover:bg-slate-100 transition-colors shrink-0"
                >
                  أنشئ حسابك الآن
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
