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
import { numberAr, relativeTime } from "../lib/format";

const TYPE_META: Record<
  AppNotification["type"],
  { label: string; tone: string; icon: React.ReactNode }
> = {
  follow_up_assigned: {
    label: "متابعة جديدة",
    tone: "violet",
    icon: <HeartHandshake className="h-4 w-4" />,
  },
  follow_up_overdue: {
    label: "متابعة متأخرة",
    tone: "danger",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  follow_up_completed: {
    label: "اكتملت متابعة",
    tone: "ok",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  attendance_alert: {
    label: "تنبيه حضور",
    tone: "warn",
    icon: <CalendarCheck className="h-4 w-4" />,
  },
};

const PREFERENCES: Array<{ key: keyof NotificationPreferences; label: string; hint: string }> = [
  { key: "followUpAssigned", label: "متابعة جديدة", hint: "عند فتح متابعة أو إسنادها إليك." },
  { key: "followUpOverdue", label: "متابعة متأخرة", hint: "عند تجاوز تاريخ الاستحقاق." },
  { key: "followUpCompleted", label: "اكتمال متابعة", hint: "عند إغلاق متابعة تخصّك." },
  { key: "attendanceAlert", label: "تنبيهات الحضور", hint: "عند تجاوز حد الغياب المفعّل." },
];

export default function NotificationsPage() {
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
      setError(err instanceof Error ? err.message : "تعذر تحميل التنبيهات");
    } finally {
      setLoading(false);
    }
  }, [tab]);

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
      showToast(err instanceof Error ? err.message : "فشل تحديث التنبيه");
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
      showToast("تم تعليم كل التنبيهات كمقروءة");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تحديث التنبيهات");
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
      showToast("تم حفظ التفضيل");
    } catch (err) {
      setPrefs(prefs);
      showToast(err instanceof Error ? err.message : "فشل حفظ التفضيل");
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
              <BellRing className="h-4 w-4" aria-hidden="true" /> مركز التنبيهات
            </>
          }
          title="التنبيهات"
          subtitle="كل ما يحتاج انتباهك: متابعات جديدة، تأخيرات، واكتمال الحالات — دون تكرار."
          actions={
            <>
              <button type="button" className="btn ghost sm" onClick={load} disabled={loading || busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> تحديث
              </button>
              <button type="button" className="btn sm" onClick={markAll} disabled={busy || unreadCount === 0}>
                <Check className="h-4 w-4" aria-hidden="true" /> تعليم الكل كمقروء
              </button>
            </>
          }
        />

        <div className="two-col">
          <section className="surface surface-pad" aria-label="قائمة التنبيهات">
            <div className="tabs2" role="tablist" aria-label="تصفية التنبيهات">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "all"}
                onClick={() => {
                  setLoading(true);
                  setTab("all");
                }}
              >
                الكل
                <span className="count">{numberAr(items.length)}</span>
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
                غير المقروء
                <span className="count">{numberAr(unreadCount)}</span>
              </button>
            </div>

            {error ? <Notice tone="danger">{error}</Notice> : null}

            {loading ? (
              <SkeletonRows rows={6} height={78} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title={tab === "unread" ? "لا توجد تنبيهات غير مقروءة" : "لا توجد تنبيهات بعد"}
                description={
                  tab === "unread"
                    ? "رائع — كل شيء تحت السيطرة."
                    : "ستصلك هنا التنبيهات عند إسناد متابعة أو تجاوز الاستحقاق أو تغيّر الحضور."
                }
              />
            ) : (
              <div className="list-stack">
                {items.map((item) => (
                  <NotificationRow key={item.id} item={item} busy={busy} onToggle={markOne} />
                ))}
              </div>
            )}
          </section>

          <aside className="surface surface-pad" aria-label="تفضيلات التنبيهات">
            <div className="surface-head">
              <div>
                <h2>
                  <Settings2 className="mr-1 inline h-4 w-4" aria-hidden="true" /> التفضيلات
                </h2>
                <p>اختر ما يصلك — تُطبَّق التفضيلات داخل قاعدة البيانات قبل إنشاء التنبيه.</p>
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
                        <b style={{ display: "block", fontSize: ".9rem" }}>{preference.label}</b>
                        <small style={{ color: "var(--mute)", fontSize: ".78rem" }}>{preference.hint}</small>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        aria-label={preference.label}
                        className={`chip ${enabled ? "on" : ""}`}
                        style={{ minWidth: 74, justifyContent: "center" }}
                        disabled={busy}
                        onClick={() => togglePreference(preference.key)}
                      >
                        {enabled ? "مفعّل" : "متوقف"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="notice" style={{ marginTop: 14 }}>
              <Bell className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                التنبيهات داخل التطبيق فقط. لا تُرسل رسائل بريد أو SMS، ولا تحتوي أي تصنيف نفسي أو سلوكي.
              </span>
            </div>
          </aside>
        </div>

        {tab === "all" && unreadShown > 0 ? (
          <p style={{ color: "var(--mute)", fontSize: ".82rem", textAlign: "center" }}>
            {numberAr(unreadShown)} تنبيه غير مقروء في هذه القائمة.
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
  const meta = TYPE_META[item.type] ?? {
    label: item.type,
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
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {unread ? <Badge tone="danger" dot>جديد</Badge> : null}
            </div>
            {item.body ? (
              <p style={{ margin: "4px 0 0", fontSize: ".85rem", color: "var(--ink-2, var(--mute))", lineHeight: 1.7 }}>
                {item.body}
              </p>
            ) : null}
            <small style={{ color: "var(--mute)", fontSize: ".76rem" }}>
              {relativeTime(item.createdAt)}
              {href ? (
                <>
                  {" · "}
                  <Link href={href} className="link-quiet">
                    فتح السجل
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
          aria-label={unread ? "تعليم كمقروء" : "تعليم كغير مقروء"}
        >
          {unread ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
          {unread ? "قرأته" : "غير مقروء"}
        </button>
      </div>
    </article>
  );
}
