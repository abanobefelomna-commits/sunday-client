"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "./motion";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";
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

const PRIMARY: Array<{ href: string; icon: typeof Home; key: AppMessageKey }> = [
  { href: "/dashboard", icon: Home, key: "nav.home" },
  { href: "/children", icon: Baby, key: "nav.children" },
  { href: "/attendance", icon: CalendarCheck, key: "nav.attendance" },
  { href: "/follow-ups", icon: HeartHandshake, key: "nav.followUpsShort" },
  { href: "/analytics", icon: BarChart3, key: "nav.analytics" },
];

const SECONDARY: Array<{ href: string; icon: typeof Home; key: AppMessageKey }> = [
  { href: "/classes", icon: BookOpen, key: "nav.classes" },
  { href: "/servants", icon: Users, key: "nav.servants" },
  { href: "/friday-prep", icon: ClipboardCheck, key: "nav.fridayPrep" },
  { href: "/news", icon: Newspaper, key: "nav.news" },
  { href: "/notifications", icon: Bell, key: "nav.notificationsShort" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const moreOpen = openedAtPath === pathname;
  const reduceMotion = useReducedMotion();
  const { t } = useI18n();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      <nav className="tb2" aria-label={t("nav.primaryAria")}>
        <div className="sidebar-brand" aria-hidden="true">
          <span className="sidebar-brand-mark">✝</span>
          <span>{t("common.appName")}</span>
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
              <span>{t(item.key)}</span>
            </Link>
          );
        })}

        <div className="nav-secondary" aria-label={t("nav.secondaryAria")}>
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
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          className="nav-more"
          onClick={() => setOpenedAtPath(pathname)}
          aria-label={t("nav.moreAria")}
          aria-expanded={moreOpen}
        >
          <span aria-hidden="true">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <span>{t("nav.more")}</span>
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
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t("nav.moreAria")}>
            <div className="sheet-head">
              <div>
                <h2>{t("nav.sheetTitle")}</h2>
                <p>{t("nav.sheetHint")}</p>
              </div>
              <button type="button" className="ib" onClick={() => setOpenedAtPath(null)} aria-label={t("common.close")}>
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
                      <b>{t(item.key)}</b>
                      <small>{t("nav.openPage")}</small>
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
