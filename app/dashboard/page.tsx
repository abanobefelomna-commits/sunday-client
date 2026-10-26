"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Baby, CheckSquare, BookOpen, Users } from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getChildren,
  getClasses,
  getServants,
  getNews,
  getAttendance,
  getStoredUser,
  type ChildItem,
  type ClassItem,
  type ServantItem,
  type NewsItem,
  type AuthUser,
} from "../lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [childrenCount, setChildrenCount] = useState(0);
  const [classesCount, setClassesCount] = useState(0);
  const [servantsCount, setServantsCount] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [careChildren, setCareChildren] = useState<ChildItem[]>([]);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    const today = new Date().toISOString().slice(0, 10);

    Promise.allSettled([
      getChildren({ limit: 100 }),
      getClasses(),
      getServants(),
      getNews("", 1, 4),
      getAttendance(undefined, today),
    ]).then(([resCh, resCl, resSv, resNw, resAtt]) => {
      if (resCh.status === "fulfilled") {
        setChildrenCount(resCh.value.total || resCh.value.data.length);
        // Children needing visitation (no attendance or flagged)
        setCareChildren(resCh.value.data.slice(0, 4));
      }
      if (resCl.status === "fulfilled") {
        setClassesCount(resCl.value.length);
        setClassesList(resCl.value);
      }
      if (resSv.status === "fulfilled") {
        setServantsCount(resSv.value.total || resSv.value.data.length);
      }
      if (resNw.status === "fulfilled") {
        setNews(resNw.value.data);
      }
      if (resAtt.status === "fulfilled") {
        const count = resAtt.value.filter((a) => a.status === "present").length;
        setPresentToday(count);
      }
      setLoading(false);
    });
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صباح الخير" : hour < 18 ? "أهلاً بيك" : "مساء الخير";
  const todayArabic = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const TILES = [
    { href: "/children", icon: <Baby className="h-5 w-5" />, title: "الأطفال", count: `${childrenCount} طفل`, color: "#3b6ff5" },
    { href: "/classes", icon: <BookOpen className="h-5 w-5" />, title: "الفصول", count: `${classesCount} فصول`, color: "#2fa36b" },
    { href: "/servants", icon: <Users className="h-5 w-5" />, title: "الخدام", count: `${servantsCount} خادم`, color: "#e8a317" },
    { href: "/attendance", icon: <CheckSquare className="h-5 w-5" />, title: "الحضور", count: `${presentToday} حاضر النهاردة`, color: "#8b5cf6" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Welcome Banner */}
        <section className="wb">
          <div>
            <small className="opacity-80 block mb-1">مساحتك في خدمة مدارس الأحد</small>
            <h1>
              {greeting} يا {user?.name || "خادم المسيح"} 👋
            </h1>
            <p className="mt-1 opacity-90">
              {todayArabic} — ربنا يبارك خدمتك
            </p>
          </div>
        </section>

        {/* Quick Navigation Tiles */}
        <div className="tl">
          {TILES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="ti"
              style={{ ["--c" as string]: t.color }}
            >
              <span className="si" aria-hidden="true">
                {t.icon}
              </span>
              <div>
                <b>{t.title}</b>
                <small>{t.count}</small>
              </div>
            </Link>
          ))}
        </div>

        {/* Visitation Alert (محتاجين افتقاد) */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              محتاجين افتقاد ومتابعة
            </h3>
            <span className="cb" style={{ ["--c" as string]: "#d64545" }}>
              {careChildren.length} أطفال
            </span>
          </div>

          {careChildren.length > 0 ? (
            careChildren.map((c) => (
              <div key={c.id} className="row">
                <div className="flex items-center gap-3">
                  <span
                    className="av2 text-sm font-bold"
                    style={{ ["--c" as string]: "#3b6ff5" }}
                  >
                    {c.name.charAt(0)}
                  </span>
                  <div>
                    <b className="block text-slate-900 dark:text-slate-100">{c.name}</b>
                    <small className="text-slate-500">{c.class?.name || "بدون فصل"}</small>
                  </div>
                </div>

                {c.parentPhone ? (
                  <a
                    className="btn sm"
                    href={`tel:${c.parentPhone}`}
                    title="اتصال بولي الأمر"
                  >
                    اتصل بولي الأمر
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">لا يوجد رقم</span>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400">
              كل الأطفال منتظمين في الحضور والخدمة 🎉
            </div>
          )}
        </div>

        {/* Latest News & Announcements */}
        <div className="card">
          <div className="ch">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              آخر الأخبار والإعلانات
            </h3>
            <Link href="/news" className="text-sm font-bold text-blue-600 dark:text-blue-400">
              عرض الكل
            </Link>
          </div>

          {news.length > 0 ? (
            news.map((item) => (
              <article key={item.id} className="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleDateString("ar-EG")}
                </span>
                {item.title && (
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {item.title}
                  </h4>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                  {item.content}
                </p>
              </article>
            ))
          ) : (
            <div className="text-center py-6 text-slate-400">
              لا توجد أخبار منشورة حالياً.
            </div>
          )}
        </div>

        {/* Class Gallery */}
        {classesList.length > 0 && (
          <div className="card">
            <div className="ch">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                فصول مدارس الأحد
              </h3>
              <Link href="/classes" className="text-sm font-bold text-blue-600 dark:text-blue-400">
                كل الفصول
              </Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
              {classesList.map((c) => (
                <Link
                  key={c.id}
                  href={`/classes/${c.id}`}
                  className="flex-none w-36 h-28 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-3 text-white flex flex-col justify-end font-bold shadow-md hover:scale-105 transition"
                >
                  <span className="text-sm">{c.name}</span>
                  <small className="text-xs opacity-75">{c.grade}</small>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
