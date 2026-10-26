"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Baby, CheckSquare, BookOpen, Users } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: <Home className="h-5 w-5" />, label: "الرئيسية" },
  { href: "/children", icon: <Baby className="h-5 w-5" />, label: "الأطفال" },
  { href: "/attendance", icon: <CheckSquare className="h-5 w-5" />, label: "الحضور" },
  { href: "/classes", icon: <BookOpen className="h-5 w-5" />, label: "الفصول" },
  { href: "/servants", icon: <Users className="h-5 w-5" />, label: "الخدام" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="tb2" aria-label="التنقل السريع">
      <div className="sidebar-brand" aria-hidden="true">
        <span className="sidebar-brand-mark">✝</span>
        <span>مدارس الأحد</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={isActive ? "on" : ""}
            aria-current={isActive ? "page" : undefined}
          >
            <span aria-hidden="true" className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
