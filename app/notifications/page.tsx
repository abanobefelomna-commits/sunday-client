"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarCheck,
  Check,
  CheckCircle2,
  HeartHandshake,
  RefreshCw,
  Settings2,
  UserRound,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { MotionGroup, MotionItem, MotionInView } from "../components/motion";
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  SkeletonRows,
} from "../components/ui";
import {
  getNotificationPreferences,
  getNotifications,
  markNotificationsRead,
  updateNotificationPreferences,
  type AppNotification,
  type NotificationPreferences,
} from "../lib/api";
import { relativeTimeFor } from "../lib/format";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";

const TYPE_META: Record<
  AppNotification["type"],
  { labelKey: AppMessageKey; tone: string; icon: React.ReactNode }
> = {
  follow_up_assigned: {
    labelKey: "notifications.typeAssigned",
    tone: "violet",
    icon: <HeartHandshake className="h-4 w-4" />,
  },
  follow_up_overdue: {
    labelKey: "notifications.typeOverdue",
    tone: "danger",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  follow_up_completed: {
    labelKey: "notifications.typeCompleted",
    tone: "ok",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  attendance_alert: {
    labelKey: "notifications.typeAttendance",
    tone: "warn",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
};

const PREFERENCES: Array<{
  key: keyof NotificationPreferences;
  labelKey: AppMessageKey;
  hintKey: AppMessageKey;
}> = [
  { key: "followUpAssigned", labelKey: "notifications.typeAssigned", hintKey: "notifications.prefAssignedHint" },
  { key: "followUpOverdue", labelKey: "notifications.typeOverdue", hintKey: "notifications.prefOverdueHint" },
  { key: "followUpCompleted", labelKey: "notifications.typeCompleted", hintKey: "notifications.prefCompletedHint" },
  { key: "attendanceAlert", labelKey: "notifications.typeAttendance", hintKey: "notifications.prefAttendanceHint" },
];

export default function NotificationsPage() {
  const { t, number } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const [resNotifications, resPrefs] = await Promise.all([
        getNotifications({ unread: tab === "unread", limit: 50 }),
        getNotificationPreferences(),
      ]);
      setItems(resNotifications.data);
      setUnreadCount(resNotifications.meta.unread);
      setPrefs(resPrefs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [tab, t]);

  useEffect(() => {
    load();
  }, [load]);

  const markOne = async (item: AppNotification) => {
    const read = !item.readAt;
    setBusy(true);
    try {
      await markNotificationsRead({ ids: [item.id], read });
      setUnreadCount((value) => Math.max(0, value + (read ? -1 : 1)));
      setItems((value) =>
        tab === "unread" && read
          ? value.filter((row) => row.id !== item.id)
          : value.map((row) =>
              row.id === item.id
                ? { ...row, readAt: read ? new Date().toISOString() : null }
                : row,
            ),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("notifications.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await markNotificationsRead({ all: true, read: true });
      setUnreadCount(0);
      if (tab === "unread") {
        setItems([]);
      } else {
        setItems((value) => value.map((row) => ({ ...row, readAt: row.readAt ?? new Date().toISOString() })));
      }
      showToast(t("notifications.allRead"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("notifications.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const togglePreference = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(true);
    try {
      const saved = await updateNotificationPreferences({ [key]: next[key] });
      setPrefs(saved);
      showToast(t("notifications.preferenceSaved"));
    } catch (err) {
      setPrefs(prefs);
      showToast(err instanceof Error ? err.message : t("notifications.preferenceFailed"));
    } finally {
      setBusy(false);
    }
  };

  const unreadShown = useMemo(
    () => items.filter((item) => !item.readAt).length,
    [items],
  );

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <BellRing className="h-4 w-4" aria-hidden="true" /> {t("notifications.eyebrow")}
            </>
          }
          title={t("notifications.title")}
          subtitle={t("notifications.subtitle")}
          actions={
            <>
              <button type="button" className="btn ghost sm" onClick={load} disabled={loading || busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("common.refresh")}
              </button>
              <button type="button" className="btn sm" onClick={markAll} disabled={busy || unreadCount === 0}>
                <Check className="h-4 w-4" aria-hidden="true" /> {t("notifications.markAll")}
              </button>
            </>
          }
        />

        <div className="two-col">
          <MotionInView as="section" className="surface surface-pad" ariaLabel={t("notifications.listAria")}>
            <div className="tabs2" role="tablist" aria-label={t("notifications.filterAria")}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                onClick={() => {
                  setLoading(true);
                  setTab("all");
                }}
              >
                {t("notifications.all")}
                <span className="count">{number(items.length)}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "unread"}
                onClick={() => {
                  setLoading(true);
                  setTab("unread");
                }}
              >
                {t("notifications.unread")}
                <span className="count">{number(unreadCount)}</span>
              </button>
            </div>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            {loading ? (
              <SkeletonRows rows={6} height={78} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title={tab === "unread" ? t("notifications.emptyUnread") : t("notifications.emptyAll")}
                description={
                  tab === "unread"
                    ? t("notifications.emptyUnreadBody")
                    : t("notifications.emptyAllBody")
                }
              />
            ) : (
              <MotionGroup className="list-stack" amount={0.05}>
                {items.map((item) => (
                  <MotionItem key={item.id}>
                    <NotificationRow item={item} busy={busy} onToggle={markOne} />
                  </MotionItem>
                ))}
              </MotionGroup>
            )}
          </MotionInView>

          <MotionInView as="aside" className="surface surface-pad" ariaLabel={t("notifications.prefsAria")} delay={0.06}>
            <div className="surface-head">
              <div>
                <h2>
                  <Settings2 className="mr-1 inline h-4 w-4" aria-hidden="true" /> {t("notifications.prefs")}
                </h2>
                <p>{t("notifications.prefsHint")}</p>
              </div>
            </div>

            {!prefs ? (
              <SkeletonRows rows={4} height={54} />
            ) : (
              <div className="stack-sm">
                {PREFERENCES.map((preference) => {
                  const enabled = prefs[preference.key];
                  return (
                    <div
                      key={preference.key}
                      className="grow-wrap"
                      style={{ justifyContent: "space-between", gap: 12 }}
                    >
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <b style={{ display: "block", fontSize: ".9rem" }}>{t(preference.labelKey)}</b>
                        <small style={{ color: "var(--mute)", fontSize: ".78rem" }}>{t(preference.hintKey)}</small>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={t(preference.labelKey)}
                        className={`chip ${enabled ? "on" : ""}`}
                        style={{ minWidth: 74, justifyContent: "center" }}
                        disabled={busy}
                        onClick={() => togglePreference(preference.key)}
                      >
                        {enabled ? t("common.enabled") : t("common.disabled")}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="notice" style={{ marginTop: 14 }}>
              <Bell className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>{t("notifications.inAppOnly")}</span>
            </div>
          </MotionInView>
        </div>

        {tab === "all" && unreadShown > 0 ? (
          <p style={{ color: "var(--mute)", fontSize: ".82rem", textAlign: "center" }}>
            {t("notifications.unreadSummary", { count: number(unreadShown) })}
          </p>
        ) : null}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}

function NotificationRow({
  item,
  busy,
  onToggle,
}: {
  item: AppNotification;
  busy: boolean;
  onToggle: (item: AppNotification) => void;
}) {
  const { t, locale } = useI18n();
  const meta = TYPE_META[item.type] ?? {
    labelKey: null,
    tone: "muted",
    icon: <Bell className="h-4 w-4" />,
  };
  const unread = !item.readAt;
  const href =
    item.entityType === "follow_up" && item.entityId
      ? `/follow-ups/${item.entityId}`
      : item.entityType === "child" && item.entityId
        ? `/children/${item.entityId}`
        : null;

  return (
    <article
      className="surface"
      style={{
        padding: 14,
        borderInlineStart: unread ? "3px solid var(--pri)" : undefined,
        background: unread ? "color-mix(in srgb, var(--pri) 4%, var(--card))" : undefined,
      }}
    >
      <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
        <div className="grow-wrap" style={{ alignItems: "flex-start" }}>
          <span className="avatar-md" aria-hidden="true" style={{ background: "color-mix(in srgb, var(--pri) 12%, transparent)", color: "var(--pri)" }}>
            {meta.icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="grow-wrap" style={{ gap: 6 }}>
              <b style={{ fontSize: ".94rem" }}>{item.title}</b>
              <Badge tone={meta.tone}>{meta.labelKey ? t(meta.labelKey) : item.type}</Badge>
              {unread ? <Badge tone="danger" dot>{t("common.new")}</Badge> : null}
            </div>
            {item.body ? (
              <p style={{ margin: "4px 0 0", fontSize: ".85rem", color: "var(--ink-2, var(--mute))", lineHeight: 1.7 }}>
                {item.body}
              </p>
            ) : null}
            <small style={{ color: "var(--mute)", fontSize: ".76rem" }}>
              {relativeTimeFor(item.createdAt, locale)}
              {href ? (
                <>
                  {" · "}
                  <Link href={href} className="link-quiet">
                    {t("notifications.openRecord")}
                  </Link>
                </>
              ) : null}
            </small>
          </div>
        </div>

        <button
          type="button"
          className="btn ghost sm"
          disabled={busy}
          onClick={() => onToggle(item)}
          aria-label={unread ? t("notifications.markRead") : t("notifications.markUnread")}
        >
          {unread ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
          {unread ? t("notifications.readAction") : t("notifications.unreadAction")}
        </button>
      </div>
    </article>
  );
}
