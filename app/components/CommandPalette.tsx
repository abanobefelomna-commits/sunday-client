"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getChildren, getServants, type ChildItem, type ServantItem } from "../lib/api";
import { SERVICE_ROLE_KEYS } from "../lib/format";
import { useI18n } from "../lib/app-i18n";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATIC_LINKS = [
  { titleKey: "commandPalette.links.dashboard", href: "/dashboard", icon: "🏠" },
  { titleKey: "commandPalette.links.children", href: "/children", icon: "🧒" },
  { titleKey: "commandPalette.links.classes", href: "/classes", icon: "📚" },
  { titleKey: "commandPalette.links.servants", href: "/servants", icon: "🤝" },
  { titleKey: "commandPalette.links.attendance", href: "/attendance", icon: "✅" },
  { titleKey: "commandPalette.links.news", href: "/news", icon: "📰" },
] as const;

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [servants, setServants] = useState<ServantItem[]>([]);

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

  const filteredLinks = STATIC_LINKS.filter((link) =>
    !q || t(link.titleKey).toLowerCase().includes(q)
  );

  const filteredChildren = q
    ? children.filter((c) => c.name.toLowerCase().includes(q) || (c.parentPhone && c.parentPhone.includes(q))).slice(0, 5)
    : [];

  const filteredServants = q
    ? servants.filter((s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))).slice(0, 5)
    : [];

  return (
    <div className="cp" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("commandPalette.aria")}>
      <div className="cpb" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder={t("commandPalette.placeholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("commandPalette.aria")}
        />

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="ci"
              onClick={onClose}
            >
              <span>
                {item.icon} {t(item.titleKey)}
              </span>
              <small className="text-slate-400">{t("commandPalette.goto")}</small>
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
              <small className="text-blue-500">{c.class?.name || t("commandPalette.childFallback")}</small>
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
              <small className="text-amber-500">
                {s.role
                  ? SERVICE_ROLE_KEYS[s.role]
                    ? t(SERVICE_ROLE_KEYS[s.role] as Parameters<typeof t>[0])
                    : s.role
                  : t("commandPalette.servantFallback")}
              </small>
            </Link>
          ))}

          {filteredLinks.length === 0 && filteredChildren.length === 0 && filteredServants.length === 0 && (
            <div className="text-center py-6 text-slate-400">{t("commandPalette.noResults")}</div>
          )}
        </div>

        <small className="hint block pt-2 text-center">{t("commandPalette.hint")}</small>
      </div>
    </div>
  );
}
