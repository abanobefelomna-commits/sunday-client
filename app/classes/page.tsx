"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { toast } from "sonner";
import { getClasses, getImageUrl, type ClassItem } from "../lib/api";

const GRADE_PALETTES = [
  "linear-gradient(135deg, #e8a317, #f59e0b)",
  "linear-gradient(135deg, #3b6ff5, #60a5fa)",
  "linear-gradient(135deg, #2fa36b, #34d399)",
  "linear-gradient(135deg, #d64545, #f87171)",
  "linear-gradient(135deg, #8b5cf6, #a78bfa)",
  "linear-gradient(135deg, #0ea5b7, #38bdf8)",
  "linear-gradient(135deg, #64748b, #94a3b8)",
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "تعذر تحميل الفصول";
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            الفصول
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            الفصول الدراسية والفقرة العامة.
          </p>
        </div>

        <div className="grid gap-3 mt-5">
          {loading ? (
            <div className="text-center py-10 text-slate-400">
              جارٍ تحميل الفصول...
            </div>
          ) : (
            classes.map((classItem, index) => {
              const hasImage = !!classItem.image;

              return (
                <article key={classItem.id} className="cc">
                  <Link
                    href={`/classes/${classItem.id}`}
                    className="cv text-white font-bold"
                    style={{
                      background: hasImage
                        ? undefined
                        : GRADE_PALETTES[index % GRADE_PALETTES.length],
                      padding: 0,
                      overflow: "hidden",
                    }}
                  >
                    {hasImage ? (
                      <img
                        src={getImageUrl(classItem.image)}
                        alt={classItem.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      "📖"
                    )}
                  </Link>

                  <div className="ci2">
                    <small>فصل مدارس الأحد</small>
                    <Link
                      href={`/classes/${classItem.id}`}
                      className="text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition"
                    >
                      {classItem.name}
                    </Link>
                    <span>
                      {classItem.childrenCount ?? classItem.children?.length ?? 0}{" "}
                      أطفال ·{" "}
                      {classItem.servantsCount ?? classItem.servants?.length ?? 0}{" "}
                      خدام
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
