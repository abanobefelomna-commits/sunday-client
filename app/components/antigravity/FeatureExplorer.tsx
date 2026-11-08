"use client";

import { useState } from "react";
import { Check, UserCheck, PhoneCall, Calendar, BarChart2, BookOpen, Layers, Users } from "lucide-react";

interface Student {
  id: string;
  name: string;
  grade: string;
  status: "present" | "absent";
}

export default function FeatureExplorer() {
  const [activeTab, setActiveTab] = useState<"attendance" | "visitation" | "classes" | "analytics">("attendance");

  // Interactive live attendance demo state
  const [students, setStudents] = useState<Student[]>([
    { id: "1", name: "مينا سامي جورج", grade: "ثالثة ابتدائي", status: "present" },
    { id: "2", name: "مريم بيشوي كامل", grade: "ثالثة ابتدائي", status: "present" },
    { id: "3", name: "كيرلس مجدي عطية", grade: "ثالثة ابتدائي", status: "absent" },
    { id: "4", name: "مارينا هاني فهيم", grade: "ثالثة ابتدائي", status: "present" },
    { id: "5", name: "ديفيد رامي موريس", grade: "ثالثة ابتدائي", status: "present" },
  ]);

  const toggleStatus = (id: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, status: s.status === "present" ? "absent" : "present" } : s))
    );
  };

  const presentCount = students.filter(s => s.status === "present").length;
  const attendanceRate = Math.round((presentCount / students.length) * 100);

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-extrabold uppercase tracking-widest text-[#1a73e8] mb-3 inline-block">
          أدوات المنصة المتكاملة
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-[#121317] tracking-tight mb-4">
          كل ما يحتاجه الخادم وأمين الخدمة في شاشة واحدة
        </h2>
        <p className="text-base sm:text-lg text-[#5f6368]">
          صممنا المنصة لتجعل إدارة الفصل والافتقاد أسرع ٥ مرات مقارنة بالطرق اليدوية والدفاتر الورقية.
        </p>
      </div>

      {/* Interactive Segmented Tab Selector */}
      <div className="flex justify-center mb-10 overflow-x-auto pb-2">
        <div className="inline-flex p-1.5 rounded-full bg-[#121317]/[0.05] border border-[#121317]/[0.08] backdrop-blur-md">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "attendance"
                ? "bg-[#121317] text-white shadow-md"
                : "text-[#5f6368] hover:text-[#121317] hover:bg-black/5"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>سجل الحضور السريع</span>
          </button>

          <button
            onClick={() => setActiveTab("visitation")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "visitation"
                ? "bg-[#121317] text-white shadow-md"
                : "text-[#5f6368] hover:text-[#121317] hover:bg-black/5"
            }`}
          >
            <PhoneCall className="w-4 h-4" />
            <span>نظام الافتقاد والرعاية</span>
          </button>

          <button
            onClick={() => setActiveTab("classes")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "classes"
                ? "bg-[#121317] text-white shadow-md"
                : "text-[#5f6368] hover:text-[#121317] hover:bg-black/5"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الفصول والمناهج</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
              activeTab === "analytics"
                ? "bg-[#121317] text-white shadow-md"
                : "text-[#5f6368] hover:text-[#121317] hover:bg-black/5"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>لوحة الكهنة والأمانة</span>
          </button>
        </div>
      </div>

      {/* Feature Display Window */}
      <div className="relative rounded-3xl border border-[#121317]/10 bg-white shadow-xl overflow-hidden min-h-[480px]">
        {/* Header Bar of the Mock IDE / App surface */}
        <div className="px-6 py-4 bg-[#f8f9fc] border-b border-[#121317]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#ea4335]" />
            <span className="w-3 h-3 rounded-full bg-[#fbbc05]" />
            <span className="w-3 h-3 rounded-full bg-[#34a853]" />
            <span className="text-xs font-bold text-[#5f6368] mr-3">
              نظام إدارة مدارس الأحد — كنيسة السيدة العذراء مريم
            </span>
          </div>
          <div className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>النظام متصل ونشط</span>
          </div>
        </div>

        {/* Tab 1: Live Interactive Attendance Demo */}
        {activeTab === "attendance" && (
          <div className="p-6 sm:p-10 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-1 space-y-4">
                <span className="text-xs font-bold text-[#1a73e8] uppercase tracking-wider">
                  تجربة حية تفاعلية
                </span>
                <h3 className="text-2xl font-bold text-[#121317]">
                  جرّب الضغط على أسماء الأطفال لتغيير حالة الحضور
                </h3>
                <p className="text-sm text-[#5f6368] leading-relaxed">
                  يستطيع الخادم رصد حضور كامل الفصل في أقل من ٣٠ ثانية، مع حفظ فوري ومزامنة فورية لكافة الخدام المشاركين في نفس الفصل.
                </p>

                <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-[#5f6368]">نسبة حضور اليوم:</span>
                    <span className="text-[#121317] font-bold text-base">{attendanceRate}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#34a853] transition-all duration-300 rounded-full"
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#5f6368] pt-1">
                    <span>حاضر: {presentCount} أطفال</span>
                    <span>غايب: {students.length - presentCount} أطفال</span>
                  </div>
                </div>
              </div>

              {/* Interactive List */}
              <div className="lg:col-span-2 space-y-3">
                <div className="text-xs font-bold text-[#5f6368] px-2 flex justify-between">
                  <span>اسم الطفل</span>
                  <span>الحالة (انقر للتبديل)</span>
                </div>
                {students.map(student => (
                  <div
                    key={student.id}
                    onClick={() => toggleStatus(student.id)}
                    className="flex items-center justify-between p-4 rounded-2xl border border-[#121317]/5 bg-[#f8f9fc] hover:bg-[#eff2f7] transition-all duration-150 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-[#121317]/10 flex items-center justify-center font-bold text-xs text-[#121317]">
                        {student.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#121317]">{student.name}</div>
                        <div className="text-xs text-[#5f6368]">{student.grade}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        student.status === "present"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {student.status === "present" ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>حاضر</span>
                        </>
                      ) : (
                        <span>غايب (يحتاج افتقاد)</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Visitation System */}
        {activeTab === "visitation" && (
          <div className="p-6 sm:p-10 animate-in fade-in duration-300">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#121317]">سجل الزيارات والافتقاد المنزلي</h3>
                  <p className="text-xs sm:text-sm text-[#5f6368]">
                    متابعة دورية لحالات الغياب، توثيق المكالمات الهاتفية، وتوزيع الزيارات على الخدام.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#1a73e8]/10 text-[#1a73e8]">
                  ٤ زيارات مجدولة هذا الأسبوع
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#121317]">الطفل: كيرلس مجدي عطية</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        تمت الزيارة بنجاح ✓
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      تمت زيارة الأسرة في المنزل ومتابعة دراسة الطفل وتقديم كتاب الألحان والترانيم.
                    </p>
                  </div>
                  <div className="text-left text-xs text-slate-500 shrink-0">
                    <div>الخادم: أ. مينا سامي</div>
                    <div>الأحد، ٢٦ أكتوبر</div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#121317]">الطفلة: سيلفيا ناصر عزيز</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        مطلوب اتصال هاتف
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      تغيبت أسبوعين متتاليين بسبب نزلة برد. مطلوب اتصال اطمئنان بوالدتها.
                    </p>
                  </div>
                  <div className="text-left text-xs text-slate-500 shrink-0">
                    <div>المسؤول: ت. مريم سمير</div>
                    <div>تذكير غداً</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Classes & Curriculum */}
        {activeTab === "classes" && (
          <div className="p-6 sm:p-10 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl border border-[#121317]/10 bg-[#f8f9fc] space-y-3">
                <div className="flex justify-between items-start">
                  <span className="w-8 h-8 rounded-xl bg-[#4285f4] text-white flex items-center justify-center font-bold text-sm">
                    ١
                  </span>
                  <span className="text-xs font-bold text-[#5f6368]">٢٨ طفلاً</span>
                </div>
                <h4 className="font-bold text-[#121317] text-base">سنة أولى وثانية ابتدائي</h4>
                <p className="text-xs text-[#5f6368]">
                  منهج قصص الكتاب المقدس، معجزات السيد المسيح، وألحان القداس المبسطة.
                </p>
                <div className="pt-2 border-t border-black/5 flex justify-between text-xs text-[#1a73e8] font-bold">
                  <span>٣ خدام مسؤولين</span>
                  <span>المنهج: ٧٠٪</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-[#121317]/10 bg-[#f8f9fc] space-y-3">
                <div className="flex justify-between items-start">
                  <span className="w-8 h-8 rounded-xl bg-[#34a853] text-white flex items-center justify-center font-bold text-sm">
                    ٣
                  </span>
                  <span className="text-xs font-bold text-[#5f6368]">٣٤ طفلاً</span>
                </div>
                <h4 className="font-bold text-[#121317] text-base">سنة ثالثة ورابعة ابتدائي</h4>
                <p className="text-xs text-[#5f6368]">
                  سير الآباء الرسل، طقس الكنيسة القبطية الأرثوذكسية، وحفظ المزامير.
                </p>
                <div className="pt-2 border-t border-black/5 flex justify-between text-xs text-[#34a853] font-bold">
                  <span>٤ خدام مسؤولين</span>
                  <span>المنهج: ٨٥٪</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-[#121317]/10 bg-[#f8f9fc] space-y-3">
                <div className="flex justify-between items-start">
                  <span className="w-8 h-8 rounded-xl bg-[#fbbc05] text-[#121317] flex items-center justify-center font-bold text-sm">
                    ٥
                  </span>
                  <span className="text-xs font-bold text-[#5f6368]">٣١ طفلاً</span>
                </div>
                <h4 className="font-bold text-[#121317] text-base">سنة خامسة وسادسة ابتدائي</h4>
                <p className="text-xs text-[#5f6368]">
                  تاريخ الكنيسة، دراسات العهد الجديد، والأنشطة والمسابقات الكنسية الكبرى.
                </p>
                <div className="pt-2 border-t border-black/5 flex justify-between text-xs text-[#e8a317] font-bold">
                  <span>٣ خدام مسؤولين</span>
                  <span>المنهج: ٦٢٪</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Priests & Super Dashboard */}
        {activeTab === "analytics" && (
          <div className="p-6 sm:p-10 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 text-center">
                <span className="text-xs text-[#5f6368] font-semibold">إجمالي الأطفال</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#121317] mt-1">١٨٤</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 text-center">
                <span className="text-xs text-[#5f6368] font-semibold">نسبة الحضور الأسبوعي</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#34a853] mt-1">٨٩٪</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 text-center">
                <span className="text-xs text-[#5f6368] font-semibold">الخدام النشطون</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1a73e8] mt-1">٢٢</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 text-center">
                <span className="text-xs text-[#5f6368] font-semibold">زيارات الافتقاد الشهرية</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#ea4335] mt-1">٥٤</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#f8f9fc] border border-[#121317]/5 text-right">
              <h4 className="text-sm font-bold text-[#121317] mb-2">ملاحظات أمانة الخدمة للآباء الكهنة</h4>
              <p className="text-xs text-[#5f6368] leading-relaxed">
                تم استقرار انتظام الفصول بعد انطلاق العام الدراسي الجديد، مع بدء خطة افتقاد للأطفال الذين لم يحضروا خلال أول أسبوعين، والتنسيق مع أولياء الأمور لتوفير كتب المناهج.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
