"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getChildren, getServants, type ChildItem, type ServantItem } from "../lib/api";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATIC_LINKS = [
  { title: "🏠 الرئيسية", href: "/dashboard" },
  { title: "🧒 دليل الأطفال", href: "/children" },
  { title: "📚 الفصول", href: "/classes" },
  { title: "🤝 الخدام", href: "/servants" },
  { title: "✅ سجل الحضور والغياب", href: "/attendance" },
  { title: "📰 الأخبار والإعلانات", href: "/news" },
];

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [servants, setServants] = useState<ServantItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      getChildren({ limit: 100 })
        .then((res) => setChildren(res.data))
        .catch(() => {});
      getServants()
        .then((res) => setServants(res.data))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const filteredLinks = STATIC_LINKS.filter((l) =>
    !q || l.title.toLowerCase().includes(q)
  );

  const filteredChildren = q
    ? children.filter((c) => c.name.toLowerCase().includes(q) || (c.parentPhone && c.parentPhone.includes(q))).slice(0, 5)
    : [];

  const filteredServants = q
    ? servants.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))).slice(0, 5)
    : [];

  return (
    <div className="cp" onClick={onClose} role="dialog" aria-modal="true">
      <div className="cpb" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="ابحث عن طفل أو خادم أو صفحة…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="بحث سريع"
        />

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ci"
              onClick={onClose}
            >
              <span>{item.title}</span>
              <small className="text-slate-400">انتقال</small>
            </Link>
          ))}

          {filteredChildren.map((c) => (
            <Link
              key={c.id}
              href={`/children?search=${encodeURIComponent(c.name)}`}
              className="ci"
              onClick={onClose}
            >
              <span>🧒 {c.name}</span>
              <small className="text-blue-500">{c.class?.name || "طفل"}</small>
            </Link>
          ))}

          {filteredServants.map((s) => (
            <Link
              key={s.id}
              href={`/servants?search=${encodeURIComponent(s.name)}`}
              className="ci"
              onClick={onClose}
            >
              <span>🤝 {s.name}</span>
              <small className="text-amber-500">{s.role || "خادم"}</small>
            </Link>
          ))}

          {filteredLinks.length === 0 && filteredChildren.length === 0 && filteredServants.length === 0 && (
            <div className="text-center py-6 text-slate-400">لا توجد نتائج بحث.</div>
          )}
        </div>

        <small className="hint block pt-2 text-center">Ctrl+K للبحث السريع، Esc للإغلاق</small>
      </div>
    </div>
  );
}
