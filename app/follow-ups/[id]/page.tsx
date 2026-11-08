"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Home,
  MessageSquare,
  NotebookPen,
  Phone,
  PlayCircle,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import {
  Badge,
  EmptyState,
  Modal,
  Notice,
  PageHeader,
  SkeletonRows,
} from "../../components/ui";
import {
  addFollowUpActivity,
  getFollowUp,
  updateFollowUp,
  type FollowUpActivity,
  type FollowUpDetail,
  type FollowUpPriority,
  type FollowUpStatus,
} from "../../lib/api";
import {
  FOLLOW_UP_STATUS_LABELS,
  PRIORITY_LABELS,
  formatDate,
  formatDateTime,
  followUpTone,
  numberAr,
  priorityTone,
  relativeTime,
} from "../../lib/format";

type ActivityType = "note" | "call" | "message" | "visit";

const ACTIVITY_META: Record<
  string,
  { label: string; icon: React.ReactNode; tone: string }
> = {
  note: { label: "ملاحظة", icon: <NotebookPen className="h-4 w-4" />, tone: "pri" },
  call: { label: "اتصال", icon: <Phone className="h-4 w-4" />, tone: "violet" },
  message: { label: "رسالة", icon: <MessageSquare className="h-4 w-4" />, tone: "warn" },
  visit: { label: "افتقاد", icon: <Home className="h-4 w-4" />, tone: "ok" },
  status_change: { label: "تغيير حالة", icon: <RefreshCw className="h-4 w-4" />, tone: "pri" },
  resolution: { label: "إغلاق", icon: <CheckCircle2 className="h-4 w-4" />, tone: "ok" },
  assignment: { label: "إسناد", icon: <UserRound className="h-4 w-4" />, tone: "violet" },
};

export default function FollowUpDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [detail, setDetail] = useState<FollowUpDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3400);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getFollowUp(id);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المتابعة");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status: FollowUpStatus, resolutionNotes?: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await updateFollowUp(id, { status, resolutionNotes });
      setResolveOpen(false);
      setDismissOpen(false);
      await load();
      showToast(
        status === "resolved"
          ? "تم إغلاق المتابعة وتوثيق القرار"
          : status === "dismissed"
            ? "تم استبعاد المتابعة"
            : "تم تحديث حالة المتابعة",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تحديث المتابعة");
    } finally {
      setBusy(false);
    }
  };

  const changePriority = async (priority: FollowUpPriority) => {
    if (!id || detail?.followUp.priority === priority) return;
    setBusy(true);
    try {
      await updateFollowUp(id, { priority });
      await load();
      showToast("تم تحديث الأولوية");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تحديث الأولوية");
    } finally {
      setBusy(false);
    }
  };

  const submitActivity = async (input: {
    type: ActivityType;
    title: string;
    notes: string;
  }) => {
    if (!id) return;
    setBusy(true);
    try {
      await addFollowUpActivity(id, {
        type: input.type,
        title: input.title,
        notes: input.notes.trim() ? input.notes.trim() : undefined,
      });
      setActivityOpen(false);
      await load();
      showToast("تم تسجيل النشاط");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تسجيل النشاط");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32">
        <AppHeader />
        <main className="pg">
          <div className="skel" style={{ height: 120 }} />
          <div className="surface surface-pad">
            <SkeletonRows rows={5} height={64} />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen pb-32">
        <AppHeader />
        <main className="pg">
          <Notice tone="danger">{error || "المتابعة غير موجودة"}</Notice>
          <Link href="/follow-ups" className="btn ghost sm" style={{ alignSelf: "flex-start" }}>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            رجوع للمتابعات
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const { followUp, child, activities } = detail;
  const active = followUp.status === "open" || followUp.status === "in_progress";

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
          <Link href="/follow-ups" className="link-quiet">
            <ArrowRight className="h-4 w-4" aria-hidden="true" /> كل المتابعات
          </Link>
          <PageHeader
            eyebrow={
              <>
                <HeartHandshake className="h-4 w-4" aria-hidden="true" /> بطاقة متابعة
              </>
            }
            title={child.name}
            subtitle={
              followUp.source === "rule"
                ? "فُتحت تلقائيًا من قاعدة رعاية معلنة"
                : followUp.source === "visitation"
                  ? "مرتبطة بافتقاد مسجّل"
                  : "متابعة يدوية موثّقة"
            }
            actions={
              <>
                {followUp.status === "open" ? (
                  <button
                    type="button"
                    className="btn sm"
                    disabled={busy}
                    onClick={() => changeStatus("in_progress")}
                  >
                    <PlayCircle className="h-4 w-4" aria-hidden="true" /> بدء المتابعة
                  </button>
                ) : null}
                {active ? (
                  <>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busy}
                      onClick={() => setResolveOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> إغلاق
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busy}
                      onClick={() => setDismissOpen(true)}
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" /> استبعاد
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={() => changeStatus("open")}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> إعادة فتح
                  </button>
                )}
              </>
            }
          />
        </div>

        <section className="surface surface-pad" aria-label="ملخص المتابعة">
          <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div className="grow-wrap">
              <Badge tone={followUpTone(followUp.status)} dot>
                {FOLLOW_UP_STATUS_LABELS[followUp.status]}
              </Badge>
              <Badge tone={priorityTone(followUp.priority)}>{PRIORITY_LABELS[followUp.priority]}</Badge>
              {followUp.isOverdue ? <Badge tone="danger">متأخرة</Badge> : null}
              <Badge tone="muted">
                {followUp.source === "rule"
                  ? "قاعدة رعاية"
                  : followUp.source === "visitation"
                    ? "افتقاد"
                    : "يدوية"}
              </Badge>
            </div>
            <Link href={`/children/${child.id}`} className="link-quiet">
              <UserRound className="h-4 w-4" aria-hidden="true" /> ملف الطالب
            </Link>
          </div>

          <p style={{ margin: "0 0 14px", fontSize: "1rem", lineHeight: 1.8 }}>{followUp.reason}</p>

          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Meta label="الفصل" value={child.className || "بدون فصل"} icon={<Home className="h-3.5 w-3.5" />} />
            <Meta
              label="الخادم المسؤول"
              value={followUp.servant?.name || "غير معيّن"}
              icon={<UserRound className="h-3.5 w-3.5" />}
            />
            <Meta
              label="تاريخ الاستحقاق"
              value={followUp.dueDate ? formatDate(followUp.dueDate) : "غير محدد"}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            />
            <Meta
              label="آخر نشاط"
              value={followUp.lastActivityAt ? relativeTime(followUp.lastActivityAt) : "لا يوجد"}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="grow-wrap" style={{ marginTop: 14 }}>
            <label className="fld" style={{ maxWidth: 220 }}>
              <span>الأولوية</span>
              <select
                value={followUp.priority}
                disabled={busy}
                onChange={(event) => changePriority(event.target.value as FollowUpPriority)}
                aria-label="تغيير أولوية المتابعة"
              >
                <option value="low">منخفضة</option>
                <option value="medium">متوسطة</option>
                <option value="high">عالية</option>
              </select>
            </label>
            {active ? (
              <button type="button" className="btn sm" onClick={() => setActivityOpen(true)} disabled={busy}>
                <NotebookPen className="h-4 w-4" aria-hidden="true" /> تسجيل نشاط
              </button>
            ) : null}
          </div>

          {followUp.resolutionNotes ? (
            <div className="notice" style={{ marginTop: 14 }}>
              <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                <b>ملاحظات الإغلاق:</b> {followUp.resolutionNotes}
                {followUp.resolvedAt ? ` — ${formatDateTime(followUp.resolvedAt)}` : ""}
              </span>
            </div>
          ) : null}
        </section>

        <section className="surface surface-pad" aria-label="سجل الأنشطة">
          <div className="surface-head" style={{ marginBottom: 14 }}>
            <div>
              <h2>سجل المتابعة</h2>
              <p>{numberAr(activities.length)} نشاط موثّق — كل خطوة تحمل وقتها وفاعلها.</p>
            </div>
          </div>

          {activities.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake className="h-5 w-5" />}
              title="لا توجد أنشطة بعد"
              description="سجّل مكالمة أو رسالة أو افتقادًا ليبدأ السجل الرعوي."
              action={
                active ? (
                  <button type="button" className="btn ghost sm" onClick={() => setActivityOpen(true)}>
                    تسجيل أول نشاط
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ActivityTimeline activities={activities} />
          )}
        </section>
      </main>

      {activityOpen ? (
        <ActivityModal
          busy={busy}
          onClose={() => setActivityOpen(false)}
          onSubmit={submitActivity}
        />
      ) : null}

      {resolveOpen ? (
        <NotesModal
          title="إغلاق المتابعة"
          subtitle="اكتب ما تم عمله والنتيجة — هذه الملاحظات جزء من السجل."
          confirmLabel="إغلاق المتابعة"
          busy={busy}
          required
          onClose={() => setResolveOpen(false)}
          onSubmit={(notes) => changeStatus("resolved", notes)}
        />
      ) : null}

      {dismissOpen ? (
        <NotesModal
          title="استبعاد المتابعة"
          subtitle="وضّح سبب الاستبعاد إن أمكن. يمكن إعادة فتح المتابعة لاحقًا."
          confirmLabel="استبعاد"
          busy={busy}
          onClose={() => setDismissOpen(false)}
          onSubmit={(notes) => changeStatus("dismissed", notes || undefined)}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="surface" style={{ padding: "10px 12px", boxShadow: "none" }}>
      <small style={{ color: "var(--mute)", fontSize: ".74rem", fontWeight: 700, display: "flex", gap: 5, alignItems: "center" }}>
        {icon}
        {label}
      </small>
      <b style={{ display: "block", fontSize: ".98rem", marginTop: 2 }}>{value}</b>
    </div>
  );
}

function ActivityTimeline({ activities }: { activities: FollowUpActivity[] }) {
  return (
    <div className="timeline">
      {activities.map((activity) => {
        const meta = ACTIVITY_META[activity.type] ?? {
          label: activity.type,
          icon: <Clock className="h-4 w-4" />,
          tone: "pri",
        };
        return (
          <div key={activity.id} className="t-item">
            <span
              className="t-dot"
              style={{ ["--t-color" as string]: `var(--${meta.tone})` }}
              aria-hidden="true"
            >
              {meta.icon}
            </span>
            <div className="t-body">
              <b>{activity.title}</b>
              {activity.notes ? <p>{activity.notes}</p> : null}
              <time dateTime={activity.occurredAt}>
                {formatDateTime(activity.occurredAt)}
                {activity.actorName ? ` · ${activity.actorName}` : ""}
                {` · ${meta.label}`}
              </time>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { type: ActivityType; title: string; notes: string }) => void;
}) {
  const [type, setType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal
      title="تسجيل نشاط"
      subtitle="سجّل الواقعة بدقة: ماذا حدث، ومتى، وما الخطوة التالية."
      onClose={onClose}
      wide
    >
      <form
        className="f"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError("عنوان النشاط مطلوب");
            return;
          }
          setError(null);
          onSubmit({ type, title: title.trim(), notes });
        }}
      >
        <div className="form-grid">
          <label className="fld">
            <span>نوع النشاط</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ActivityType)}
              disabled={busy}
            >
              <option value="call">اتصال هاتفي</option>
              <option value="message">رسالة</option>
              <option value="visit">افتقاد</option>
              <option value="note">ملاحظة</option>
            </select>
          </label>
          <label className="fld">
            <span>العنوان *</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: اتصال بولي الأمر"
              maxLength={180}
              disabled={busy}
            />
          </label>
          <label className="fld full">
            <span>تفاصيل</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ما تم مناقشته، وما الخطوة التالية…"
              maxLength={2000}
              disabled={busy}
            />
          </label>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "جارٍ التسجيل…" : "تسجيل النشاط"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NotesModal({
  title,
  subtitle,
  confirmLabel,
  busy,
  required = false,
  onClose,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  confirmLabel: string;
  busy: boolean;
  required?: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide>
      <form
        className="f"
        onSubmit={(event) => {
          event.preventDefault();
          if (required && !notes.trim()) {
            setError("ملاحظات الإغلاق مطلوبة");
            return;
          }
          setError(null);
          onSubmit(notes.trim());
        }}
      >
        <label className="fld full">
          <span>{required ? "ملاحظات الإغلاق *" : "سبب الاستبعاد"}</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            disabled={busy}
            placeholder={required ? "ما تم عمله والنتيجة…" : "سبب اختياري…"}
          />
        </label>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "جارٍ الحفظ…" : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
