"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "../motion";
import { useI18n } from "../../lib/app-i18n";
import { formatDateTimeFor } from "../../lib/format";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  color,
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  color?: string;
  trend?: ReactNode;
}) {
  return (
    <article className="kpi" style={{ ["--kpi-color" as string]: color ?? "var(--pri)" }}>
      <div className="kpi-top">
        <span>{label}</span>
        {icon ? <span className="kpi-icon" aria-hidden="true">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {trend ? <span className="trend">{trend}</span> : null}
      {hint ? <small>{hint}</small> : null}
    </article>
  );
}

export function Badge({
  children,
  tone = "default",
  dot = false,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone === "default" ? "" : tone} ${dot ? "dot" : ""}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <span className="empty-icon" aria-hidden="true">{icon}</span> : null}
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 4, height = 64 }: { rows?: number; height?: number }) {
  return (
    <div className="stack-sm" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skel" style={{ height }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skel" style={{ height: 118 }} />
      ))}
    </div>
  );
}

export function ProgressRing({
  value,
  label,
  caption,
  color,
}: {
  value: number | null;
  label?: string;
  caption?: string;
  color?: string;
}) {
  const { t } = useI18n();
  const safe = Math.max(0, Math.min(100, value ?? 0));
  const shownLabel = label ?? t("ui.ringDefault");
  return (
    <div
      className="ring"
      style={{
        ["--val" as string]: safe,
        ["--ok" as string]: color ?? "var(--ok)",
      }}
      role="img"
      aria-label={t("ui.ringAria", {
        label: shownLabel,
        value: value === null ? t("ui.ringNoValue") : `${value}%`,
      })}
    >
      <div>
        <strong>{value === null ? "—" : `${value}%`}</strong>
        <small>{caption ?? shownLabel}</small>
      </div>
    </div>
  );
}

export function MiniBars({
  data,
  height = 120,
}: {
  data: Array<{ label: string; value: number; hint?: string }>;
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { t } = useI18n();
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className="mini-bars" style={{ height }} role="img" aria-label={t("ui.chartAria")}>
      {data.map((item) => (
        <div key={item.label} title={item.hint ?? `${item.label}: ${item.value}`}>
          <motion.i
            initial={false}
            animate={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: MOTION.duration.chart, ease: MOTION.ease }
            }
          />
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    description?: string | null;
    date: string;
    tone?: string;
    icon?: ReactNode;
  }>;
}) {
  const { t, locale } = useI18n();
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🕊️"
        title={t("ui.timelineEmpty")}
        description={t("ui.timelineEmptyHint")}
      />
    );
  }
  return (
    <div className="timeline">
      {items.map((item) => (
        <div key={item.id} className="t-item">
          <span
            className="t-dot"
            style={{ ["--t-color" as string]: `var(--${item.tone ?? "pri"})` }}
            aria-hidden="true"
          >
            {item.icon ?? "•"}
          </span>
          <div className="t-body">
            <b>{item.title}</b>
            {item.description ? <p>{item.description}</p> : null}
            <time dateTime={item.date}>{formatDateTimeFor(item.date, locale)}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={wide ? { width: "min(720px, 100%)" } : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="ib" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Notice({
  tone = "default",
  children,
}: {
  tone?: "default" | "warn" | "danger";
  children: ReactNode;
}) {
  return <div className={`notice ${tone === "default" ? "" : tone}`}>{children}</div>;
}

export { FloatingLabelInput, type FloatingLabelInputProps } from "./FloatingInput";

