"use client";

import { useState } from "react";
import { Check, Mail, Send, CheckCircle2 } from "lucide-react";

export default function NewsletterSection() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["الكل"]);
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const topics = [
    "الكل",
    "فصول حضانة",
    "فصول ابتدائي",
    "فصول إعدادي",
    "أفكار وسائل إيضاح",
    "مسابقات وألحان",
  ];

  const toggleTopic = (topic: string) => {
    if (topic === "الكل") {
      setSelectedTopics(["الكل"]);
      return;
    }
    const current = selectedTopics.filter((t) => t !== "الكل");
    if (current.includes(topic)) {
      const next = current.filter((t) => t !== topic);
      setSelectedTopics(next.length === 0 ? ["الكل"] : next);
    } else {
      setSelectedTopics([...current, topic]);
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsSubscribed(true);
    }, 700);
  };

  return (
    <section id="newsletter" className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto scroll-mt-20">
      <div className="rounded-3xl p-8 sm:p-14 border border-[#121317]/10 bg-[#f8f9fc] shadow-xl text-center">
        <div className="max-w-2xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#1a73e8] mb-3 inline-block">
            النشرة الدورية للخدمة
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-[#121317] tracking-tight mb-4">
            ابقَ على تواصل مع مستجدات مدارس الأحد
          </h2>
          <p className="text-sm sm:text-base text-[#5f6368] mb-8">
            احصل دورياً على أحدث تحضيرات المناهج الكنسية، أفكار وسائل الإيضاح، والأنشطة الروحية المناسبة لكل مرحلة.
          </p>

          {/* Interactive Topic Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {topics.map((t) => {
              const active = selectedTopics.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTopic(t)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer ${
                    active
                      ? "bg-[#121317] text-white shadow-sm"
                      : "bg-white text-[#45474d] hover:bg-black/5 border border-[#121317]/10"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Form / Subscription Input */}
          {isSubscribed ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center gap-3 animate-in fade-in duration-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-sm font-bold">
                تم تسجيل اشتراكك بنجاح! سنرسل لك المناهج والأفكار الدورية على بريدك.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-2 max-w-md mx-auto">
                <div className="relative w-full">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="اكتب بريدك الإلكتروني..."
                    required
                    className="w-full pr-11 pl-4 py-3.5 rounded-full border border-[#121317]/15 bg-white text-sm text-[#121317] placeholder:text-slate-400 focus:outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20 transition-all shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-full text-xs sm:text-sm font-bold text-white bg-[#121317] hover:bg-[#1a73e8] transition-all duration-200 shadow-md hover:shadow-lg shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {loading ? "جاري الحفظ..." : "اشتراك في النشرة"}
                </button>
              </div>
              <p className="text-[11px] text-[#5f6368]">
                نحترم خصوصيتك بالكامل. لا نقوم بمشاركة بريدك إطلاقاً، ويمكنك إلغاء الاشتراك في أي وقت.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
