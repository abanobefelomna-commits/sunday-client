"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "./motion";
import {
  BarChart3,
  Baby,
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  HeartHandshake,
  Home,
  LayoutGrid,
  Newspaper,
  Users,
  X,
} from "lucide-react";

const PRIMARY = [
  { href: "/dashboard", icon: Home, label: "الرئيسية" },
  { href: "/children", icon: Baby, label: "الأطفال" },
  { href: "/attendance", icon: CalendarCheck, label: "الحضور" },
  { href: "/follow-ups", icon: HeartHandshake, label: "المتابعات" },
  { href: "/analytics", icon: BarChart3, label: "التحليلات" },
];

const SECONDARY = [
  { href: "/classes", icon: BookOpen, label: "الفصول" },
  { href: "/servants", icon: Users, label: "الخدام" },
  { href: "/friday-prep", icon: ClipboardCheck, label: "تحضير الجمعة" },
  { href: "/news", icon: Newspaper, label: "الأخبار" },
  { href: "/notifications", icon: Bell, label: "التنبيهات" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const moreOpen = openedAtPath === pathname;
  const reduceMotion = useReducedMotion();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      <nav className="tb2" aria-label="التنقل السريع">
        <div className="sidebar-brand" aria-hidden="true">
          <span className="sidebar-brand-mark">✝</span>
          <span>مدارس الأحد</span>
        </div>

        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "on" : ""}
              aria-current={active ? "page" : undefined}
            >
              {active && <motion.span className="nav-active-indicator" layoutId="active-nav-item" transition={{ duration: reduceMotion ? 0 : MOTION.duration.micro, ease: MOTION.ease }} aria-hidden="true" />}
              <span aria-hidden="true" className="text-xl">
                <Icon className="h-5 w-5" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="nav-secondary" aria-label="روابط إضافية">
          {SECONDARY.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`secondary ${active ? "on" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {active && <motion.span className="nav-active-indicator" layoutId="active-nav-item" transition={{ duration: reduceMotion ? 0 : MOTION.duration.micro, ease: MOTION.ease }} aria-hidden="true" />}
                <span aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="nav-more"
          onClick={() => setOpenedAtPath(pathname)}
          aria-label="المزيد من الصفحات"
          aria-expanded={moreOpen}
        >
          <span aria-hidden="true">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <span>المزيد</span>
        </button>
      </nav>

      {moreOpen ? (
        <div
          className="sheet-backdrop"
          style={{ zIndex: 45 }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpenedAtPath(null);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true" aria-label="المزيد من الصفحات">
            <div className="sheet-head">
              <div>
                <h2>المزيد</h2>
                <p>كل صفحات الخدمة في مكان واحد</p>
              </div>
              <button type="button" className="ib" onClick={() => setOpenedAtPath(null)} aria-label="إغلاق">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="list-stack">
              {SECONDARY.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="listrow" onClick={() => setOpenedAtPath(null)}>
                    <span className="avatar-md" aria-hidden="true">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="grow">
                      <b>{item.label}</b>
                      <small>فتح الصفحة</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
