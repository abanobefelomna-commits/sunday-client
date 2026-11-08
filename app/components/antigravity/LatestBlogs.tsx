"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpLeft, BookOpen, Calendar } from "lucide-react";

export default function LatestBlogs() {
  const articles = [
    {
      title: "نظام الافتقاد الإلكتروني 2026: كيف نصل لكل طفل غائب باهتمام ومحبة؟",
      date: "٢٩ أكتوبر ٢٠٢٦",
      tag: "الميزات الجديدة",
      readTime: "٤ دقائق",
      desc: "خطوات عملية للاستفادة من تنبيهات الغياب التلقائية في رعاية الأطفال المنقطعين وربطهم بالكنيسة مجدداً.",
    },
    {
      title: "دليل الخادم الناجح: ٧ أسرار لجذب انتباه أطفال المرحلة الابتدائية",
      date: "٢٤ أكتوبر ٢٠٢٦",
      tag: "تدريب الخدام",
      readTime: "٦ دقائق",
      desc: "كيف تحول الدرس الأسبوعي إلى تجربة تفاعلية مليئة بالحب والشغف بالكلمة الإلهية والقصص الكنسية.",
    },
    {
      title: "مسابقة الكتاب المقدس السنوية: وسائل إيضاح وأسئلة تفاعلية لكل فصل",
      date: "١٥ أكتوبر ٢٠٢٦",
      tag: "المناهج والمسابقات",
      readTime: "٥ دقائق",
      desc: "تحميل نماذج المسابقات والأنشطة الروحية الجاهزة للطباعة والتوزيع على الأطفال في فترات الصوم والأعياد.",
    },
    {
      title: "أمان البيانات والخصوصية الكنسية في عصر التحول الرقمي",
      date: "٢٨ سبتمبر ٢٠٢٦",
      tag: "الخصوصية والأمان",
      readTime: "٣ دقائق",
      desc: "كيف نضمن سرية بيانات الأطفال وأرقام هواتف الأسر ضمن أعلى معايير الخصوصية الرقمية المعتمدة.",
    },
  ];

  return (
    <section id="insights" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#1a73e8] mb-3 inline-block">
            المكتبة والمستجدات الروحية
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-[#121317] tracking-tight">
            أحدث المقالات والمناهج الكنسية
          </h2>
        </div>

        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1a73e8] hover:underline mt-4 sm:mt-0 group"
        >
          <span>عرض كافة الأخبار والمقالات</span>
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {articles.map((item) => (
          <div
            key={item.title}
            className="group rounded-3xl p-6 border border-[#121317]/10 bg-[#f8f9fc] hover:bg-white hover:border-[#121317]/20 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#121317]/5 text-[#45474d]">
                  {item.tag}
                </span>
                <span className="text-xs text-[#5f6368]">{item.readTime}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#5f6368] mb-3">
                <Calendar className="w-3.5 h-3.5" />
                <span>{item.date}</span>
              </div>

              <h3 className="font-bold text-[#121317] text-lg leading-snug mb-3 group-hover:text-[#1a73e8] transition-colors">
                {item.title}
              </h3>

              <p className="text-xs text-[#5f6368] leading-relaxed mb-6">
                {item.desc}
              </p>
            </div>

            <div className="pt-4 border-t border-[#121317]/5 flex items-center justify-between text-xs font-bold text-[#121317] group-hover:text-[#1a73e8]">
              <span>قراءة المقال</span>
              <ArrowUpLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-translate-x-0.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
