"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "الرئيسية" },
  { href: "/children", icon: "🧒", label: "الأطفال" },
  { href: "/attendance", icon: "✅", label: "الحضور" },
  { href: "/classes", icon: "📚", label: "الفصول" },
  { href: "/servants", icon: "🤝", label: "الخدام" },
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
