"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HeartHandshake,
  NotebookPen,
  Phone,
  Plus,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  Badge,
  EmptyState,
  Modal,
  Timeline,
} from "../../../components/ui";
import type {
  EducationalProgress,
  FollowUpPriority,
  FollowUpStatus,
  StudentProfile,
} from "../../../lib/api";
import {
  ATTENDANCE_LABELS,
  FOLLOW_UP_STATUS_LABELS,
  LEVEL_LABELS,
  PRIORITY_LABELS,
  VISIBILITY_LABELS,
  VISIT_STATUS_LABELS,
  VISIT_TYPE_LABELS,
  attendanceTone,
  formatDate,
  formatDateTime,
  followUpTone,
  initials,
  numberAr,
  percent,
  priorityTone,
  shiftIso,
  todayIso,
} from "../../../lib/format";

/* ------------------------------- Overview ------------------------------- */

const TYPE_META: Record<string, { tone: string; icon: React.ReactNode }> = {
  attendance: { tone: "ok", icon: <CalendarCheck className="h-4 w-4" /> },
  visitation: { tone: "violet", icon: <HeartHandshake className="h-4 w-4" /> },
  follow_up: { tone: "warn", icon: <Activity className="h-4 w-4" /> },
  activity: { tone: "pri", icon: <CheckCircle2 className="h-4 w-4" /> },
  progress: { tone: "ok", icon: <TrendingUp className="h-4 w-4" /> },
  note: { tone: "muted", icon: <NotebookPen className="h-4 w-4" /> },
};

export function OverviewTab({ profile }: { profile: StudentProfile }) {
  const { student } = profile;
  const openFollowUp = profile.followUps.find(
    (item) => item.status === "open" || item.status === "in_progress",
  );

  return (
    <div className="two-col">
      <section className="surface surface-pad" aria-label="الخط الزمني">
        <div className="surface-head">
          <div>
            <h2>الخط الزمني للرحلة</h2>
            <p>أحدث الأحداث من الحضور والافتقاد والمتابعة والتقدم</p>
          </div>
          <Badge tone="muted">{numberAr(profile.timeline.length)} حدث</Badge>
        </div>
        <Timeline
          items={profile.timeline.slice(0, 24).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            date: item.date,
            tone: TYPE_META[item.type]?.tone ?? "pri",
            icon: TYPE_META[item.type]?.icon,
          }))}
        />
      </section>

      <div className="stack">
        <section className="surface surface-pad" aria-label="بيانات التواصل">
          <div className="surface-head">
            <h2>بيانات التواصل</h2>
          </div>
          <div className="stack-sm">
            <InfoRow label="ولي الأمر" value={student.parentName || "غير مسجّل"} />
            <InfoRow label="هاتف ولي الأمر" value={student.parentPhone || "غير مسجّل"} ltr />
            <InfoRow label="هاتف الطفل" value={student.phone || "غير مسجّل"} ltr />
            <InfoRow label="العنوان" value={student.address || "غير مسجّل"} />
            <InfoRow label="تاريخ التسجيل" value={formatDate(student.createdAt)} />
            <InfoRow label="آخر حضور" value={formatDate(profile.stats.lastAttendanceDate)} />
            <InfoRow label="آخر افتقاد مكتمل" value={formatDate(profile.stats.lastVisitDate)} />
          </div>
          {student.parentPhone ? (
            <a
              href={`tel:${student.parentPhone}`}
              className="btn sm"
              style={{ width: "100%", marginTop: 14 }}
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> اتصال بولي الأمر
            </a>
          ) : null}
        </section>

        <section className="surface surface-pad" aria-label="فريق الرعاية">
          <div className="surface-head">
            <h2>فريق الرعاية</h2>
            <Badge tone="muted">{numberAr(student.responsibleServants.length)} خادم</Badge>
          </div>
          {student.responsibleServants.length > 0 ? (
            <div className="list-stack">
              {student.responsibleServants.slice(0, 6).map((servant) => (
                <div key={servant.id} className="listrow" style={{ padding: "10px 12px" }}>
                  <span className="avatar-md" aria-hidden="true">
                    {initials(servant.name)}
                  </span>
                  <span className="grow">
                    <b>{servant.name || "خادم"}</b>
                    <small>{servant.role}</small>
                  </span>
                  {servant.phone ? (
                    <a className="ib" href={`tel:${servant.phone}`} aria-label={`اتصال بـ ${servant.name}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<UserRound className="h-5 w-5" />}
              title="لا يوجد خادم مسؤول"
              description="يمكن تعيين خادم مسؤول من شاشة تعديل بيانات الطفل."
            />
          )}
        </section>

        <section className="surface surface-pad" aria-label="حالة المتابعة">
          <div className="surface-head">
            <h2>حالة المتابعة</h2>
          </div>
          {openFollowUp ? (
            <div className="stack-sm">
              <div className="grow-wrap">
                <Badge tone={followUpTone(openFollowUp.status)} dot>
                  {FOLLOW_UP_STATUS_LABELS[openFollowUp.status]}
                </Badge>
                <Badge tone={priorityTone(openFollowUp.priority)}>
                  {PRIORITY_LABELS[openFollowUp.priority]}
                </Badge>
                {openFollowUp.isOverdue ? <Badge tone="danger">متأخرة</Badge> : null}
              </div>
              <p style={{ margin: 0, fontSize: ".9rem", color: "var(--mute)" }}>{openFollowUp.reason}</p>
              <p style={{ margin: 0, fontSize: ".82rem", color: "var(--mute)" }}>
                الاستحقاق: {formatDate(openFollowUp.dueDate)}
              </p>
              <Link href={`/follow-ups/${openFollowUp.id}`} className="link-quiet">
                فتح المتابعة <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="لا توجد متابعة نشطة"
              description="الطفل غير مسجّل في أي متابعة مفتوحة حاليًا."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function InfoRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: ".88rem" }}>
      <span style={{ color: "var(--mute)" }}>{label}</span>
      <b style={{ textAlign: "end", fontWeight: 600 }} dir={ltr ? "ltr" : undefined}>
        {value}
      </b>
    </div>
  );
}

/* ------------------------------ Attendance ------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  present: "var(--ok)",
  absent: "var(--danger)",
  late: "var(--warn)",
  excused: "var(--violet)",
};

export function AttendanceTab({ profile }: { profile: StudentProfile }) {
  const byDate = useMemo(() => {
    const map = new Map<string, StudentProfile["attendance"][number]>();
    profile.attendance.forEach((row) => map.set(row.date, row));
    return map;
  }, [profile.attendance]);

  const days = useMemo(() => {
    const today = todayIso();
    return Array.from({ length: 35 }, (_, index) => shiftIso(today, -(34 - index)));
  }, []);

  return (
    <div className="stack">
      <section className="surface surface-pad" aria-label="ملخص الحضور">
        <div className="surface-head">
          <div>
            <h2>ملخص الحضور</h2>
            <p>{numberAr(profile.stats.totalSessions)} جلسة مسجّلة · نسبة {percent(profile.stats.attendanceRate)}</p>
          </div>
          <Badge tone={profile.stats.currentStreak > 0 ? "ok" : "muted"}>
            سلسلة حضور: {numberAr(profile.stats.currentStreak)}
          </Badge>
        </div>
        <div className="kpi-grid">
          <MiniCounter label="حاضر" value={profile.stats.present} color="var(--ok)" />
          <MiniCounter label="غائب" value={profile.stats.absent} color="var(--danger)" />
          <MiniCounter label="متأخر" value={profile.stats.late} color="var(--warn)" />
          <MiniCounter label="بعذر" value={profile.stats.excused} color="var(--violet)" />
        </div>
      </section>

      <section className="surface surface-pad" aria-label="خريطة آخر 35 يومًا">
        <div className="surface-head">
          <div>
            <h2>آخر 35 يومًا</h2>
            <p>كل مربع يمثّل يومًا؛ الأيام الفارغة بلا تسجيل.</p>
          </div>
          <div className="legend" style={{ margin: 0 }}>
            {Object.entries(STATUS_COLORS).map(([key, color]) => (
              <span key={key}>
                <i style={{ ["--l-color" as string]: color }} /> {ATTENDANCE_LABELS[key]}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 6,
          }}
          role="img"
          aria-label="خريطة الحضور اليومية"
        >
          {days.map((day) => {
            const record = byDate.get(day);
            const color = record ? STATUS_COLORS[record.status] : "var(--line)";
            return (
              <div
                key={day}
                title={`${formatDate(day)} — ${record ? ATTENDANCE_LABELS[record.status] : "لا تسجيل"}`}
                style={{
                  aspectRatio: "1",
                  borderRadius: 9,
                  background: record
                    ? `color-mix(in srgb, ${color} 82%, transparent)`
                    : "color-mix(in srgb, var(--mute) 8%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--mute) 12%, transparent)",
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="surface surface-pad" aria-label="سجل الحضور">
        <div className="surface-head">
          <h2>سجل الحضور</h2>
          <Badge tone="muted">{numberAr(profile.attendance.length)} سجل</Badge>
        </div>
        {profile.attendance.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-5 w-5" />}
            title="لا توجد سجلات حضور"
            description="سيظهر هنا كل حضور وغياب بمجرد تسجيله من صفحة الحضور."
          />
        ) : (
          <div className="list-stack">
            {profile.attendance.map((row) => (
              <div key={row.id} className="listrow">
                <span
                  className="avatar-md"
                  style={{ ["--a-color" as string]: STATUS_COLORS[row.status] }}
                  aria-hidden="true"
                >
                  <CalendarCheck className="h-4 w-4" />
                </span>
                <span className="grow">
                  <b>{ATTENDANCE_LABELS[row.status]}</b>
                  <small>
                    {formatDate(row.date)} · {row.className || "بدون فصل"}
                  </small>
                </span>
                {row.notes ? <small style={{ maxWidth: 200, color: "var(--mute)" }}>{row.notes}</small> : null}
                <Badge tone={attendanceTone(row.status)}>{ATTENDANCE_LABELS[row.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniCounter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="surface" style={{ padding: "12px 14px", boxShadow: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--mute)", fontSize: ".78rem", fontWeight: 700 }}>
        <i style={{ width: 8, height: 8, borderRadius: 3, background: color }} aria-hidden="true" />
        {label}
      </span>
      <b style={{ display: "block", fontSize: "1.3rem" }}>{numberAr(value)}</b>
    </div>
  );
}

/* ------------------------------- Follow-ups ------------------------------ */

export function FollowUpsTab({
  profile,
  busy,
  canWrite,
  onCreate,
  onUpdate,
  onAddActivity,
}: {
  profile: StudentProfile;
  busy: boolean;
  canWrite: boolean;
  onCreate: (input: {
    reason: string;
    priority: FollowUpPriority;
    servantId: string | null;
    dueDate: string | null;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    input: {
      status?: FollowUpStatus;
      priority?: FollowUpPriority;
      servantId?: string | null;
      dueDate?: string | null;
      resolutionNotes?: string | null;
    },
  ) => Promise<void>;
  onAddActivity: (
    id: string,
    input: { type: "note" | "call" | "message" | "visit"; title: string; notes?: string },
  ) => Promise<void>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [activityTarget, setActivityTarget] = useState<string | null>(null);

  const active = profile.followUps.filter((item) => item.status === "open" || item.status === "in_progress");
  const closed = profile.followUps.filter((item) => item.status !== "open" && item.status !== "in_progress");

  return (
    <div className="stack">
      <section className="surface surface-pad" aria-label="متابعات الطالب">
        <div className="surface-head">
          <div>
            <h2>المتابعات الرعوية</h2>
            <p>قرارات مبنية على وقائع مسجّلة وقواعد معلنة — دون تصنيف نفسي أو سلوكي.</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> متابعة جديدة
            </button>
          ) : null}
        </div>

        {active.length === 0 && closed.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="h-5 w-5" />}
            title="لا توجد متابعات"
            description="افتح متابعة يدوية أو شغّل قواعد المتابعة من صفحة المتابعات."
          />
        ) : (
          <div className="stack">
            {active.length > 0 ? (
              <div className="stack-sm">
                <h3 className="section-title">نشطة ({numberAr(active.length)})</h3>
                {active.map((item) => (
                  <FollowUpCard
                    key={item.id}
                    item={item}
                    busy={busy}
                    onResolve={canWrite ? () => setResolveTarget(item.id) : undefined}
                    onStart={canWrite ? () => onUpdate(item.id, { status: "in_progress" }) : undefined}
                    onDismiss={canWrite ? () => onUpdate(item.id, { status: "dismissed" }) : undefined}
                    onActivity={canWrite ? () => setActivityTarget(item.id) : undefined}
                  />
                ))}
              </div>
            ) : null}

            {closed.length > 0 ? (
              <div className="stack-sm">
                <h3 className="section-title">مغلقة ({numberAr(closed.length)})</h3>
                {closed.map((item) => (
                  <FollowUpCard key={item.id} item={item} busy={busy} />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {canWrite && createOpen ? (
        <CreateFollowUpModal
          servants={profile.student.responsibleServants}
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onSave={async (input) => {
            await onCreate(input);
            setCreateOpen(false);
          }}
        />
      ) : null}

      {canWrite && resolveTarget ? (
        <ResolveModal
          busy={busy}
          onClose={() => setResolveTarget(null)}
          onSave={async (notes) => {
            await onUpdate(resolveTarget, { status: "resolved", resolutionNotes: notes });
            setResolveTarget(null);
          }}
        />
      ) : null}

      {canWrite && activityTarget ? (
        <ActivityModal
          busy={busy}
          onClose={() => setActivityTarget(null)}
          onSave={async (input) => {
            await onAddActivity(activityTarget, input);
            setActivityTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}

function FollowUpCard({
  item,
  busy,
  onStart,
  onResolve,
  onDismiss,
  onActivity,
}: {
  item: StudentProfile["followUps"][number];
  busy: boolean;
  onStart?: () => void;
  onResolve?: () => void;
  onDismiss?: () => void;
  onActivity?: () => void;
}) {
  const isActive = item.status === "open" || item.status === "in_progress";
  return (
    <article className="surface" style={{ padding: 16 }}>
      <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="grow-wrap">
          <Badge tone={followUpTone(item.status)} dot>
            {FOLLOW_UP_STATUS_LABELS[item.status]}
          </Badge>
          <Badge tone={priorityTone(item.priority)}>{PRIORITY_LABELS[item.priority]}</Badge>
          {item.isOverdue ? <Badge tone="danger">متأخرة</Badge> : null}
          <Badge tone="muted">{item.source === "rule" ? "قاعدة تلقائية" : item.source === "visitation" ? "افتقاد" : "يدوية"}</Badge>
        </div>
        <Link href={`/follow-ups/${item.id}`} className="link-quiet">
          التفاصيل <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: ".92rem" }}>{item.reason}</p>

      <div className="grow-wrap" style={{ color: "var(--mute)", fontSize: ".8rem" }}>
        <span>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> الاستحقاق: {formatDate(item.dueDate)}
        </span>
        <span>المسؤول: {item.servant?.name || "غير معيّن"}</span>
        <span>الأنشطة: {numberAr(item.activityCount)}</span>
        <span>آخر نشاط: {item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "—"}</span>
      </div>

      {item.resolutionNotes ? (
        <p style={{ margin: "8px 0 0", fontSize: ".84rem", color: "var(--mute)" }}>
          ملاحظات الإغلاق: {item.resolutionNotes}
        </p>
      ) : null}

      {isActive && (onStart || onResolve || onDismiss || onActivity) ? (
        <div className="grow-wrap" style={{ marginTop: 12 }}>
          {item.status === "open" && onStart ? (
            <button type="button" className="btn ghost sm" onClick={onStart} disabled={busy}>
              بدء المتابعة
            </button>
          ) : null}
          {onActivity ? (
            <button type="button" className="btn ghost sm" onClick={onActivity} disabled={busy}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> تسجيل نشاط
            </button>
          ) : null}
          {onResolve ? (
            <button type="button" className="btn sm" onClick={onResolve} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> إغلاق
            </button>
          ) : null}
          {onDismiss ? (
            <button type="button" className="btn ghost sm" onClick={onDismiss} disabled={busy}>
              استبعاد
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function CreateFollowUpModal({
  servants,
  busy,
  onClose,
  onSave,
}: {
  servants: StudentProfile["student"]["responsibleServants"];
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    reason: string;
    priority: FollowUpPriority;
    servantId: string | null;
    dueDate: string | null;
  }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<FollowUpPriority>("medium");
  const [servantId, setServantId] = useState(servants[0]?.id ?? "");
  const [dueDate, setDueDate] = useState(shiftIso(todayIso(), 7));
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal title="فتح متابعة جديدة" subtitle="اكتب سببًا واضحًا مبنيًا على وقائع يمكن مراجعتها." onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reason.trim()) {
            setError("سبب المتابعة مطلوب");
            return;
          }
          setError(null);
          await onSave({
            reason: reason.trim(),
            priority,
            servantId: servantId || null,
            dueDate: dueDate || null,
          });
        }}
      >
        <div className="fld">
          <label htmlFor="fu_reason">سبب المتابعة *</label>
          <textarea
            id="fu_reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثال: غياب متكرر خلال آخر أسبوعين دون تواصل مع الأسرة."
            disabled={busy}
          />
        </div>
        <div className="form-grid">
          <div className="fld">
            <label htmlFor="fu_priority">الأولوية</label>
            <select
              id="fu_priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as FollowUpPriority)}
              disabled={busy}
            >
              <option value="low">منخفضة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="fu_due">تاريخ الاستحقاق</label>
            <input
              id="fu_due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="fld full">
            <label htmlFor="fu_servant">الخادم المسؤول</label>
            <select
              id="fu_servant"
              value={servantId}
              onChange={(event) => setServantId(event.target.value)}
              disabled={busy || servants.length === 0}
            >
              <option value="">بدون تعيين</option>
              {servants.map((servant) => (
                <option key={servant.id} value={servant.id}>
                  {servant.name} — {servant.role}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "جارٍ الفتح…" : "فتح المتابعة"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResolveModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  return (
    <Modal title="إغلاق المتابعة" subtitle="ملاحظات الإغلاق إلزامية لتوثيق ما تم." onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!notes.trim()) return;
          await onSave(notes.trim());
        }}
      >
        <div className="fld">
          <label htmlFor="res_notes">ملاحظات الإغلاق *</label>
          <textarea
            id="res_notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="ما الذي تم عمله؟ وما نتيجة المتابعة؟"
            disabled={busy}
          />
        </div>
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy || !notes.trim()}>
            {busy ? "جارٍ الإغلاق…" : "تأكيد الإغلاق"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActivityModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (input: { type: "note" | "call" | "message" | "visit"; title: string; notes?: string }) => Promise<void>;
}) {
  const [type, setType] = useState<"note" | "call" | "message" | "visit">("call");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Modal title="تسجيل نشاط رعوي" subtitle="سجّل ما تم فعليًا: مكالمة، رسالة، زيارة أو ملاحظة." onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim()) return;
          await onSave({ type, title: title.trim(), notes: notes.trim() || undefined });
        }}
      >
        <div className="form-grid">
          <div className="fld">
            <label htmlFor="act_type">نوع النشاط</label>
            <select
              id="act_type"
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              disabled={busy}
            >
              <option value="call">اتصال هاتفي</option>
              <option value="message">رسالة</option>
              <option value="visit">زيارة</option>
              <option value="note">ملاحظة</option>
            </select>
          </div>
          <div className="fld full">
            <label htmlFor="act_title">العنوان *</label>
            <input
              id="act_title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              placeholder="مثال: اتصال بولي الأمر للاطمئنان"
            />
          </div>
          <div className="fld full">
            <label htmlFor="act_notes">تفاصيل</label>
            <textarea
              id="act_notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? "جارٍ التسجيل…" : "تسجيل"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------- Progress ------------------------------- */

const LEVEL_TONE: Record<string, "ok" | "warn" | "violet" | "default"> = {
  beginner: "warn",
  growing: "default",
  proficient: "ok",
  advanced: "violet",
};

export function ProgressTab({
  profile,
  busy,
  canWrite,
  onAdd,
  onDelete,
}: {
  profile: StudentProfile;
  busy: boolean;
  canWrite: boolean;
  onAdd: (input: {
    subject: string;
    level: EducationalProgress["level"];
    score: number | null;
    notes: string;
    assessedAt: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="surface surface-pad" aria-label="التقدم التعليمي">
      <div className="surface-head">
        <div>
          <h2>التقدم التعليمي</h2>
          <p>تقييم تعليمي صريح فقط — لا يُستخدم لتصنيف السلوك أو الشخصية.</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> تسجيل تقييم
          </button>
        ) : null}
      </div>

      {profile.progress.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="لا توجد تقييمات تعليمية"
          description="أضف أول تقييم لمادة معيّنة لتظهر في الخط الزمني ومتوسط التقدم."
        />
      ) : (
        <div className="list-stack">
          {profile.progress.map((item) => (
            <article key={item.id} className="surface" style={{ padding: 14 }}>
              <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
                <div className="grow-wrap">
                  <b>{item.subject}</b>
                  <Badge tone={LEVEL_TONE[item.level] ?? "default"}>{LEVEL_LABELS[item.level] ?? item.level}</Badge>
                  {item.score !== null && item.score !== undefined ? (
                    <Badge tone="muted">{Number(item.score)} / 100</Badge>
                  ) : null}
                </div>
                {canWrite ? (
                  <button
                    type="button"
                    className="ib"
                    style={{ color: "var(--danger)" }}
                    onClick={() => onDelete(item.id)}
                    disabled={busy}
                    aria-label={`حذف تقييم ${item.subject}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p style={{ margin: "6px 0 0", color: "var(--mute)", fontSize: ".84rem" }}>
                {formatDate(item.assessedAt)} · {item.assessorName || "غير محدد"}
              </p>
              {item.notes ? <p style={{ margin: "6px 0 0", fontSize: ".88rem" }}>{item.notes}</p> : null}
            </article>
          ))}
        </div>
      )}

      {canWrite && open ? (
        <AddProgressModal
          busy={busy}
          onClose={() => setOpen(false)}
          onSave={async (input) => {
            await onAdd(input);
            setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function AddProgressModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (input: {
    subject: string;
    level: EducationalProgress["level"];
    score: number | null;
    notes: string;
    assessedAt: string;
  }) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState<EducationalProgress["level"]>("growing");
  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [assessedAt, setAssessedAt] = useState(todayIso());

  return (
    <Modal title="تسجيل تقييم تعليمي" subtitle="المادة والمستوى والدرجة (اختيارية)." onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!subject.trim()) return;
          await onSave({
            subject: subject.trim(),
            level,
            score: score === "" ? null : Number(score),
            notes: notes.trim(),
            assessedAt,
          });
        }}
      >
        <div className="form-grid">
          <div className="fld full">
            <label htmlFor="pr_subject">المادة *</label>
            <input
              id="pr_subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="مثال: الكتاب المقدس / التسبيح"
              disabled={busy}
            />
          </div>
          <div className="fld">
            <label htmlFor="pr_level">المستوى</label>
            <select
              id="pr_level"
              value={level}
              onChange={(event) => setLevel(event.target.value as EducationalProgress["level"])}
              disabled={busy}
            >
              <option value="beginner">مبتدئ</option>
              <option value="growing">ينمو</option>
              <option value="proficient">متمكن</option>
              <option value="advanced">متقدم</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="pr_score">الدرجة (0–100)</label>
            <input
              id="pr_score"
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(event) => setScore(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="fld">
            <label htmlFor="pr_date">تاريخ التقييم</label>
            <input
              id="pr_date"
              type="date"
              value={assessedAt}
              max={todayIso()}
              onChange={(event) => setAssessedAt(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="fld full">
            <label htmlFor="pr_notes">ملاحظات تعليمية</label>
            <textarea
              id="pr_notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={busy || !subject.trim()}>
            {busy ? "جارٍ الحفظ…" : "حفظ التقييم"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* --------------------------------- Notes -------------------------------- */

export function NotesTab({
  profile,
  busy,
  canWrite,
  onAdd,
  onDelete,
}: {
  profile: StudentProfile;
  busy: boolean;
  canWrite: boolean;
  onAdd: (body: string, visibility: "class" | "leaders" | "private") => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"class" | "leaders" | "private">("class");

  return (
    <div className="stack">
      {canWrite ? (
        <section className="surface surface-pad" aria-label="إضافة ملاحظة">
          <div className="surface-head">
            <h2>إضافة ملاحظة موثّقة</h2>
          </div>
          <form
            className="f"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!body.trim()) return;
              await onAdd(body.trim(), visibility);
              setBody("");
            }}
          >
            <div className="fld">
              <label htmlFor="note_body">نص الملاحظة *</label>
              <textarea
                id="note_body"
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="اكتب واقعة محددة وقابلة للمراجعة…"
                disabled={busy}
              />
            </div>
            <div className="grow-wrap" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <label className="fld" style={{ maxWidth: 200 }}>
                <span>مستوى الظهور</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  disabled={busy}
                >
                  <option value="class">الفصل</option>
                  {profile.permissions.manager ? <option value="leaders">القيادة</option> : null}
                  <option value="private">خاصة بي</option>
                </select>
              </label>
              <button type="submit" className="btn sm" disabled={busy || !body.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" /> إضافة
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="surface surface-pad" aria-label="الملاحظات">
        <div className="surface-head">
          <div>
            <h2>الملاحظات</h2>
            <p>الملاحظات الخاصة تظهر لكاتبها فقط، وملاحظات القيادة للمسؤولين.</p>
          </div>
          <Badge tone="muted">{numberAr(profile.notes.length)}</Badge>
        </div>

        {profile.notes.length === 0 ? (
          <EmptyState
            icon={<NotebookPen className="h-5 w-5" />}
            title="لا توجد ملاحظات"
            description="سجّل ملاحظة واضحة تساعد فريق الرعاية على المتابعة."
          />
        ) : (
          <div className="list-stack">
            {profile.notes.map((note) => (
              <article key={note.id} className="surface" style={{ padding: 14 }}>
                <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
                  <div className="grow-wrap">
                    <Badge
                      tone={
                        note.visibility === "private"
                          ? "muted"
                          : note.visibility === "leaders"
                            ? "violet"
                            : "default"
                      }
                    >
                      {VISIBILITY_LABELS[note.visibility] ?? note.visibility}
                    </Badge>
                    <small style={{ color: "var(--mute)" }}>
                      {note.authorName || "غير معروف"} · {formatDateTime(note.createdAt)}
                    </small>
                  </div>
                  {canWrite ? (
                    <button
                      type="button"
                      className="ib"
                      style={{ color: "var(--danger)" }}
                      onClick={() => onDelete(note.id)}
                      disabled={busy}
                      aria-label="حذف الملاحظة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p style={{ margin: "8px 0 0", fontSize: ".9rem", whiteSpace: "pre-wrap" }}>{note.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------- Visitations ----------------------------- */

export function VisitationsTab({ profile }: { profile: StudentProfile }) {
  return (
    <section className="surface surface-pad" aria-label="سجل الافتقاد">
      <div className="surface-head">
        <div>
          <h2>سجل الافتقاد</h2>
          <p>افتقاد منزلي، اتصال هاتفي، وزيارات الكنيسة.</p>
        </div>
        <Badge tone="muted">{numberAr(profile.visitations.length)}</Badge>
      </div>

      {profile.visitations.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-5 w-5" />}
          title="لا يوجد سجل افتقاد"
          description="سيظهر هنا كل افتقاد مسجّل مع حالته وتاريخه والخادم المسؤول."
        />
      ) : (
        <div className="list-stack">
          {profile.visitations.map((visit) => (
            <div key={visit.id} className="listrow">
              <span className="avatar-md" aria-hidden="true">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <span className="grow">
                <b>{VISIT_TYPE_LABELS[visit.type] ?? visit.type}</b>
                <small>
                  {formatDate(visit.date)} · {visit.servantName || "غير محدد"}
                </small>
              </span>
              <Badge tone={visit.status === "completed" ? "ok" : visit.status === "cancelled" ? "muted" : "warn"}>
                {VISIT_STATUS_LABELS[visit.status] ?? visit.status}
              </Badge>
              {visit.followUpDate ? (
                <small style={{ color: "var(--mute)" }}>متابعة: {formatDate(visit.followUpDate)}</small>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
