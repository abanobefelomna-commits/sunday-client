"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import { getClass, type ClassItem } from "../../lib/api";

export default function ClassDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClass(id)
      .then((data) => setClassData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <AppHeader />
        <div className="pg text-center py-20 text-slate-400">جارٍ تحميل تفاصيل الفصل...</div>
        <BottomNav />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
        <AppHeader />
        <div className="pg text-center py-20">
          <h2 className="text-xl font-bold mb-4">الفصل غير موجود</h2>
          <Link href="/classes" className="btn">
            العودة لكل الفصول
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const children = classData.children || [];
  const servants = classData.servants || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        <Link href="/classes" className="hint inline-block mb-1">
          ← العودة لكل الفصول
        </Link>

        {/* Cover Header */}
        <div className="cover bg-gradient-to-tr from-blue-700 to-indigo-500 min-h-44 rounded-3xl p-6 text-white flex flex-col justify-end shadow-xl">
          <small className="opacity-80">فصل مدارس الأحد · {classData.grade}</small>
          <h1 className="text-3xl font-extrabold mt-1">{classData.name}</h1>
          <p className="text-sm opacity-90 mt-1">السنة الدراسية: {classData.academicYear}</p>
        </div>

        {/* Action Button: Take Attendance for this class */}
        <div className="flex gap-3">
          <Link
            href={`/attendance?classId=${classData.id}`}
            className="btn big flex-1 text-center"
          >
            ✅ تسجيل حضور هذا الفصل اليوم
          </Link>
        </div>

        {/* Children List in this Class */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              الأطفال المسجلين ({children.length})
            </h3>
            <Link
              href="/children"
              className="text-sm text-blue-600 dark:text-blue-400 font-bold"
            >
              + إضافة طفل
            </Link>
          </div>

          {children.length > 0 ? (
            children.map((c) => (
              <div key={c.id} className="row">
                <b className="text-slate-900 dark:text-slate-100">{c.name}</b>
                {c.phone ? (
                  <a
                    href={`tel:${c.phone}`}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    dir="ltr"
                  >
                    {c.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">الهاتف غير متوفر</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              لا يوجد أطفال مسجلين في هذا الفصل حتى الآن.
            </div>
          )}
        </div>

        {/* Servants in this Class */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              خدام الفصل ({servants.length})
            </h3>
            <Link
              href="/servants"
              className="text-sm text-blue-600 dark:text-blue-400 font-bold"
            >
              دليل الخدام
            </Link>
          </div>

          {servants.length > 0 ? (
            servants.map((s) => (
              <div key={s.id} className="row">
                <b className="text-slate-900 dark:text-slate-100">{s.name}</b>
                {s.phone ? (
                  <a
                    href={`tel:${s.phone}`}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                    dir="ltr"
                  >
                    {s.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">الهاتف غير متوفر</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              لا يوجد خدام معينين لهذا الفصل حتى الآن.
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
