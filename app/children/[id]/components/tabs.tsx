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
  SERVICE_ROLE_KEYS,
  attendanceTone,
  formatDateFor,
  formatDateTimeFor,
  followUpTone,
  initials,
  priorityTone,
  shiftIso,
  todayIso,
} from "../../../lib/format";
import { useI18n } from "../../../lib/app-i18n";

const VISIT_TYPE_KEYS: Record<string, string> = {
  home_visit: "tabs.visitHome",
  phone_call: "tabs.visitPhone",
  church_visit: "tabs.visitChurch",
};

const VISIT_STATUS_KEYS: Record<string, string> = {
  planned: "tabs.visitPlanned",
  completed: "tabs.visitCompleted",
  cancelled: "tabs.visitCancelled",
};

const LEVEL_KEYS: Record<string, string> = {
  beginner: "tabs.levelBeginner",
  growing: "tabs.levelGrowing",
  proficient: "tabs.levelProficient",
  advanced: "tabs.levelAdvanced",
};

const VISIBILITY_KEYS: Record<string, string> = {
  class: "tabs.visibilityClass",
  leaders: "tabs.visibilityLeaders",
  private: "tabs.visibilityPrivate",
};

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
  const { t, locale, number } = useI18n();
  const { student } = profile;
  const openFollowUp = profile.followUps.find(
    (item) => item.status === "open" || item.status === "in_progress",
  );

  return (
    <div className="two-col">
      <section className="surface surface-pad" aria-label={t("tabs.timelineAria")}>
        <div className="surface-head">
          <div>
            <h2>{t("tabs.timelineTitle")}</h2>
            <p>{t("tabs.timelineHint")}</p>
          </div>
          <Badge tone="muted">{t("tabs.timelineCount", { count: number(profile.timeline.length) })}</Badge>
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
        <section className="surface surface-pad" aria-label={t("tabs.contactAria")}>
          <div className="surface-head">
            <h2>{t("tabs.contactTitle")}</h2>
          </div>
          <div className="stack-sm">
            <InfoRow label={t("tabs.parent")} value={student.parentName || t("attendance.notRecorded")} />
            <InfoRow label={t("tabs.parentPhone")} value={student.parentPhone || t("attendance.notRecorded")} ltr />
            <InfoRow label={t("tabs.childPhone")} value={student.phone || t("attendance.notRecorded")} ltr />
            <InfoRow label={t("tabs.registeredAt")} value={formatDateFor(student.createdAt, locale)} />
            <InfoRow label={t("tabs.lastAttendance")} value={formatDateFor(profile.stats.lastAttendanceDate, locale)} />
            <InfoRow label={t("tabs.lastVisit")} value={formatDateFor(profile.stats.lastVisitDate, locale)} />
          </div>
          {student.parentPhone ? (
            <a
              href={`tel:${student.parentPhone}`}
              className="btn sm"
              style={{ width: "100%", marginTop: 14 }}
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> {t("tabs.callParent")}
            </a>
          ) : null}
        </section>

        <section className="surface surface-pad" aria-label={t("tabs.careTeamAria")}>
          <div className="surface-head">
            <h2>{t("tabs.careTeamTitle")}</h2>
            <Badge tone="muted">
              {t("tabs.servantCount", { count: number(student.responsibleServants.length) })}
            </Badge>
          </div>
          {student.responsibleServants.length > 0 ? (
            <div className="list-stack">
              {student.responsibleServants.slice(0, 6).map((servant) => (
                <div key={servant.id} className="listrow" style={{ padding: "10px 12px" }}>
                  <span className="avatar-md" aria-hidden="true">
                    {initials(servant.name)}
                  </span>
                  <span className="grow">
                    <b>{servant.name || t("common.notAssigned")}</b>
                    <small>
                      {servant.role
                        ? SERVICE_ROLE_KEYS[servant.role]
                          ? t(SERVICE_ROLE_KEYS[servant.role] as Parameters<typeof t>[0])
                          : servant.role
                        : ""}
                    </small>
                  </span>
                  {servant.phone ? (
                    <a
                      className="ib"
                      href={`tel:${servant.phone}`}
                      aria-label={t("tabs.callAria", { name: servant.name || "" })}
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<UserRound className="h-5 w-5" />}
              title={t("tabs.noServantTitle")}
              description={t("tabs.noServantHint")}
            />
          )}
        </section>

        <section className="surface surface-pad" aria-label={t("tabs.followUpAria")}>
          <div className="surface-head">
            <h2>{t("tabs.followUpTitle")}</h2>
          </div>
          {openFollowUp ? (
            <div className="stack-sm">
              <div className="grow-wrap">
                <Badge tone={followUpTone(openFollowUp.status)} dot>
                  {t(`status.${openFollowUp.status}`)}
                </Badge>
                <Badge tone={priorityTone(openFollowUp.priority)}>
                  {t(`priority.${openFollowUp.priority}`)}
                </Badge>
                {openFollowUp.isOverdue ? <Badge tone="danger">{t("common.overdue")}</Badge> : null}
              </div>
              <p style={{ margin: 0, fontSize: ".9rem", color: "var(--mute)" }}>{openFollowUp.reason}</p>
              <p style={{ margin: 0, fontSize: ".82rem", color: "var(--mute)" }}>
                {t("tabs.due", { date: formatDateFor(openFollowUp.dueDate, locale) })}
              </p>
              <Link href={`/follow-ups/${openFollowUp.id}`} className="link-quiet">
                {t("tabs.openFollowUp")} <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title={t("tabs.noActiveTitle")}
              description={t("tabs.noActiveHint")}
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
  const { t, locale, number, percent } = useI18n();
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
      <section className="surface surface-pad" aria-label={t("tabs.attendanceSummaryAria")}>
        <div className="surface-head">
          <div>
            <h2>{t("tabs.attendanceSummaryTitle")}</h2>
            <p>
              {t("tabs.attendanceSummaryHint", {
                count: number(profile.stats.totalSessions),
                rate: percent(profile.stats.attendanceRate),
              })}
            </p>
          </div>
          <Badge tone={profile.stats.currentStreak > 0 ? "ok" : "muted"}>
            {t("tabs.streak", { count: number(profile.stats.currentStreak) })}
          </Badge>
        </div>
        <div className="kpi-grid">
          <MiniCounter label={t("attendance.present")} value={profile.stats.present} color="var(--ok)" />
          <MiniCounter label={t("attendance.absent")} value={profile.stats.absent} color="var(--danger)" />
          <MiniCounter label={t("attendance.late")} value={profile.stats.late} color="var(--warn)" />
          <MiniCounter label={t("attendance.excused")} value={profile.stats.excused} color="var(--violet)" />
        </div>
      </section>

      <section className="surface surface-pad" aria-label={t("tabs.mapAria")}>
        <div className="surface-head">
          <div>
            <h2>{t("tabs.mapTitle")}</h2>
            <p>{t("tabs.mapHint")}</p>
          </div>
          <div className="legend" style={{ margin: 0 }}>
            {Object.entries(STATUS_COLORS).map(([key, color]) => (
              <span key={key}>
                <i style={{ ["--l-color" as string]: color }} />{" "}
                {t(`attendance.${key}` as Parameters<typeof t>[0])}
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
          aria-label={t("tabs.mapLegendAria")}
        >
          {days.map((day) => {
            const record = byDate.get(day);
            const color = record ? STATUS_COLORS[record.status] : "var(--line)";
            return (
              <div
                key={day}
                title={`${formatDateFor(day, locale)} — ${
                  record ? t(`attendance.${record.status}`) : t("tabs.noRecord")
                }`}
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

      <section className="surface surface-pad" aria-label={t("tabs.logAria")}>
        <div className="surface-head">
          <h2>{t("tabs.logTitle")}</h2>
          <Badge tone="muted">{t("tabs.recordCount", { count: number(profile.attendance.length) })}</Badge>
        </div>
        {profile.attendance.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-5 w-5" />}
            title={t("tabs.noRecordsTitle")}
            description={t("tabs.noRecordsHint")}
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
                  <b>{t(`attendance.${row.status}`)}</b>
                  <small>
                    {formatDateFor(row.date, locale)} · {row.className || t("common.noClass")}
                  </small>
                </span>
                {row.notes ? <small style={{ maxWidth: 200, color: "var(--mute)" }}>{row.notes}</small> : null}
                <Badge tone={attendanceTone(row.status)}>{t(`attendance.${row.status}`)}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniCounter({ label, value, color }: { label: string; value: number; color: string }) {
  const { number } = useI18n();
  return (
    <div className="surface" style={{ padding: "12px 14px", boxShadow: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--mute)", fontSize: ".78rem", fontWeight: 700 }}>
        <i style={{ width: 8, height: 8, borderRadius: 3, background: color }} aria-hidden="true" />
        {label}
      </span>
      <b style={{ display: "block", fontSize: "1.3rem" }}>{number(value)}</b>
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
  const { t, number } = useI18n();

  const active = profile.followUps.filter((item) => item.status === "open" || item.status === "in_progress");
  const closed = profile.followUps.filter((item) => item.status !== "open" && item.status !== "in_progress");

  return (
    <div className="stack">
      <section className="surface surface-pad" aria-label={t("tabs.followUpsAria")}>
        <div className="surface-head">
          <div>
            <h2>{t("tabs.followUpsTitle")}</h2>
            <p>{t("tabs.followUpsHint")}</p>
          </div>
          {canWrite ? (
            <button type="button" className="btn sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("tabs.newFollowUp")}
            </button>
          ) : null}
        </div>

        {active.length === 0 && closed.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="h-5 w-5" />}
            title={t("tabs.noFollowUpsTitle")}
            description={t("tabs.noFollowUpsHint")}
          />
        ) : (
          <div className="stack">
            {active.length > 0 ? (
              <div className="stack-sm">
                <h3 className="section-title">{t("tabs.activeCount", { count: number(active.length) })}</h3>
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
                <h3 className="section-title">{t("tabs.closedCount", { count: number(closed.length) })}</h3>
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
  const { t, locale, number } = useI18n();
  const isActive = item.status === "open" || item.status === "in_progress";
  return (
    <article className="surface" style={{ padding: 16 }}>
      <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="grow-wrap">
          <Badge tone={followUpTone(item.status)} dot>
            {t(`status.${item.status}`)}
          </Badge>
          <Badge tone={priorityTone(item.priority)}>{t(`priority.${item.priority}`)}</Badge>
          {item.isOverdue ? <Badge tone="danger">{t("common.overdue")}</Badge> : null}
          <Badge tone="muted">
            {item.source === "rule"
              ? t("followUps.sourceRule")
              : item.source === "visitation"
                ? t("followUps.sourceVisitation")
                : t("followUps.sourceManual")}
          </Badge>
        </div>
        <Link href={`/follow-ups/${item.id}`} className="link-quiet">
          {t("common.details")} <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </div>

      <p style={{ margin: "0 0 8px", fontSize: ".92rem" }}>{item.reason}</p>

      <div className="grow-wrap" style={{ color: "var(--mute)", fontSize: ".8rem" }}>
        <span>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />{" "}
          {t("tabs.due", { date: formatDateFor(item.dueDate, locale) })}
        </span>
        <span>
          {t("followUps.servant", { name: item.servant?.name || t("common.notAssigned") })}
        </span>
        <span>{t("tabs.activities", { count: number(item.activityCount) })}</span>
        <span>
          {t("tabs.lastActivity", {
            date: item.lastActivityAt ? formatDateTimeFor(item.lastActivityAt, locale) : "—",
          })}
        </span>
      </div>

      {item.resolutionNotes ? (
        <p style={{ margin: "8px 0 0", fontSize: ".84rem", color: "var(--mute)" }}>
          {t("tabs.resolutionNotes", { notes: item.resolutionNotes })}
        </p>
      ) : null}

      {isActive && (onStart || onResolve || onDismiss || onActivity) ? (
        <div className="grow-wrap" style={{ marginTop: 12 }}>
          {item.status === "open" && onStart ? (
            <button type="button" className="btn ghost sm" onClick={onStart} disabled={busy}>
              {t("tabs.start")}
            </button>
          ) : null}
          {onActivity ? (
            <button type="button" className="btn ghost sm" onClick={onActivity} disabled={busy}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("tabs.logActivity")}
            </button>
          ) : null}
          {onResolve ? (
            <button type="button" className="btn sm" onClick={onResolve} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("tabs.close")}
            </button>
          ) : null}
          {onDismiss ? (
            <button type="button" className="btn ghost sm" onClick={onDismiss} disabled={busy}>
              {t("tabs.dismiss")}
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
  const { t } = useI18n();

  return (
    <Modal title={t("tabs.createTitle")} subtitle={t("tabs.createSubtitle")} onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reason.trim()) {
            setError(t("tabs.requiredReason"));
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
          <label htmlFor="fu_reason">{t("tabs.reasonLabel")}</label>
          <textarea
            id="fu_reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("tabs.reasonPlaceholder")}
            disabled={busy}
          />
        </div>
        <div className="form-grid">
          <div className="fld">
            <label htmlFor="fu_priority">{t("common.priority")}</label>
            <select
              id="fu_priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as FollowUpPriority)}
              disabled={busy}
            >
              <option value="low">{t("priority.low")}</option>
              <option value="medium">{t("priority.medium")}</option>
              <option value="high">{t("priority.high")}</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="fu_due">{t("tabs.dueLabel")}</label>
            <input
              id="fu_due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="fld full">
            <label htmlFor="fu_servant">{t("tabs.servantLabel")}</label>
            <select
              id="fu_servant"
              value={servantId}
              onChange={(event) => setServantId(event.target.value)}
              disabled={busy || servants.length === 0}
            >
              <option value="">{t("tabs.noServantOption")}</option>
              {servants.map((servant) => (
                <option key={servant.id} value={servant.id}>
                  {servant.name} —{" "}
                  {SERVICE_ROLE_KEYS[servant.role]
                    ? t(SERVICE_ROLE_KEYS[servant.role] as Parameters<typeof t>[0])
                    : servant.role}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t("tabs.opening") : t("tabs.openAction")}
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
  const { t } = useI18n();
  return (
    <Modal title={t("tabs.resolveTitle")} subtitle={t("tabs.resolveSubtitle")} onClose={onClose}>
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!notes.trim()) return;
          await onSave(notes.trim());
        }}
      >
        <div className="fld">
          <label htmlFor="res_notes">{t("tabs.resolveNotesLabel")}</label>
          <textarea
            id="res_notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t("tabs.resolveNotesPlaceholder")}
            disabled={busy}
          />
        </div>
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy || !notes.trim()}>
            {busy ? t("tabs.closing") : t("tabs.confirmClose")}
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
  const { t } = useI18n();

  return (
    <Modal title={t("tabs.activityTitle")} subtitle={t("tabs.activitySubtitle")} onClose={onClose}>
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
            <label htmlFor="act_type">{t("tabs.activityType")}</label>
            <select
              id="act_type"
              value={type}
              onChange={(event) => setType(event.target.value as typeof type)}
              disabled={busy}
            >
              <option value="call">{t("tabs.call")}</option>
              <option value="message">{t("tabs.message")}</option>
              <option value="visit">{t("tabs.visit")}</option>
              <option value="note">{t("tabs.note")}</option>
            </select>
          </div>
          <div className="fld full">
            <label htmlFor="act_title">{t("tabs.titleLabel")}</label>
            <input
              id="act_title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              placeholder={t("tabs.titlePlaceholder")}
            />
          </div>
          <div className="fld full">
            <label htmlFor="act_notes">{t("tabs.detailsLabel")}</label>
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
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy || !title.trim()}>
            {busy ? t("tabs.logging") : t("tabs.log")}
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
  const { t, locale } = useI18n();

  return (
    <section className="surface surface-pad" aria-label={t("tabs.progressAria")}>
      <div className="surface-head">
        <div>
          <h2>{t("tabs.progressTitle")}</h2>
          <p>{t("tabs.progressHint")}</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("tabs.addAssessment")}
          </button>
        ) : null}
      </div>

      {profile.progress.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title={t("tabs.noProgressTitle")}
          description={t("tabs.noProgressHint")}
        />
      ) : (
        <div className="list-stack">
          {profile.progress.map((item) => (
            <article key={item.id} className="surface" style={{ padding: 14 }}>
              <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
                <div className="grow-wrap">
                  <b>{item.subject}</b>
                  <Badge tone={LEVEL_TONE[item.level] ?? "default"}>
                    {LEVEL_KEYS[item.level]
                      ? t(LEVEL_KEYS[item.level] as Parameters<typeof t>[0])
                      : item.level}
                  </Badge>
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
                    aria-label={t("tabs.assessDeleteAria", { subject: item.subject })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p style={{ margin: "6px 0 0", color: "var(--mute)", fontSize: ".84rem" }}>
                {formatDateFor(item.assessedAt, locale)} · {item.assessorName || t("tabs.notSpecified")}
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
  const { t } = useI18n();

  return (
    <Modal title={t("tabs.assessmentTitle")} subtitle={t("tabs.assessmentSubtitle")} onClose={onClose}>
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
            <label htmlFor="pr_subject">{t("tabs.subject")}</label>
            <input
              id="pr_subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("tabs.subjectPlaceholder")}
              disabled={busy}
            />
          </div>
          <div className="fld">
            <label htmlFor="pr_level">{t("tabs.level")}</label>
            <select
              id="pr_level"
              value={level}
              onChange={(event) => setLevel(event.target.value as EducationalProgress["level"])}
              disabled={busy}
            >
              <option value="beginner">{t("tabs.levelBeginner")}</option>
              <option value="growing">{t("tabs.levelGrowing")}</option>
              <option value="proficient">{t("tabs.levelProficient")}</option>
              <option value="advanced">{t("tabs.levelAdvanced")}</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="pr_score">{t("tabs.score")}</label>
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
            <label htmlFor="pr_date">{t("tabs.assessmentDate")}</label>
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
            <label htmlFor="pr_notes">{t("tabs.educationalNotes")}</label>
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
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy || !subject.trim()}>
            {busy ? t("tabs.savingAssessment") : t("tabs.saveAssessment")}
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
  const { t, locale, number } = useI18n();

  return (
    <div className="stack">
      {canWrite ? (
        <section className="surface surface-pad" aria-label={t("tabs.notesAddAria")}>
          <div className="surface-head">
            <h2>{t("tabs.notesAddTitle")}</h2>
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
              <label htmlFor="note_body">{t("tabs.noteLabel")}</label>
              <textarea
                id="note_body"
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t("tabs.notePlaceholder")}
                disabled={busy}
              />
            </div>
            <div className="grow-wrap" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <label className="fld" style={{ maxWidth: 200 }}>
                <span>{t("tabs.visibility")}</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  disabled={busy}
                >
                  <option value="class">{t("tabs.visibilityClass")}</option>
                  {profile.permissions.manager ? (
                    <option value="leaders">{t("tabs.visibilityLeaders")}</option>
                  ) : null}
                  <option value="private">{t("tabs.visibilityPrivate")}</option>
                </select>
              </label>
              <button type="submit" className="btn sm" disabled={busy || !body.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("tabs.add")}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="surface surface-pad" aria-label={t("tabs.notesAria")}>
        <div className="surface-head">
          <div>
            <h2>{t("tabs.notesTitle")}</h2>
            <p>{t("tabs.notesHint")}</p>
          </div>
          <Badge tone="muted">{number(profile.notes.length)}</Badge>
        </div>

        {profile.notes.length === 0 ? (
          <EmptyState
            icon={<NotebookPen className="h-5 w-5" />}
            title={t("tabs.noNotesTitle")}
            description={t("tabs.noNotesHint")}
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
                      {VISIBILITY_KEYS[note.visibility]
                        ? t(VISIBILITY_KEYS[note.visibility] as Parameters<typeof t>[0])
                        : note.visibility}
                    </Badge>
                    <small style={{ color: "var(--mute)" }}>
                      {note.authorName || t("tabs.unknownAuthor")} ·{" "}
                      {formatDateTimeFor(note.createdAt, locale)}
                    </small>
                  </div>
                  {canWrite ? (
                    <button
                      type="button"
                      className="ib"
                      style={{ color: "var(--danger)" }}
                      onClick={() => onDelete(note.id)}
                      disabled={busy}
                      aria-label={t("tabs.deleteNoteAria")}
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
  const { t, locale, number } = useI18n();
  return (
    <section className="surface surface-pad" aria-label={t("tabs.visitationsAria")}>
      <div className="surface-head">
        <div>
          <h2>{t("tabs.visitationsTitle")}</h2>
          <p>{t("tabs.visitationsHint")}</p>
        </div>
        <Badge tone="muted">{number(profile.visitations.length)}</Badge>
      </div>

      {profile.visitations.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="h-5 w-5" />}
          title={t("tabs.noVisitsTitle")}
          description={t("tabs.noVisitsHint")}
        />
      ) : (
        <div className="list-stack">
          {profile.visitations.map((visit) => (
            <div key={visit.id} className="listrow">
              <span className="avatar-md" aria-hidden="true">
                <HeartHandshake className="h-4 w-4" />
              </span>
              <span className="grow">
                <b>
                  {VISIT_TYPE_KEYS[visit.type]
                    ? t(VISIT_TYPE_KEYS[visit.type] as Parameters<typeof t>[0])
                    : visit.type}
                </b>
                <small>
                  {formatDateFor(visit.date, locale)} ·{" "}
                  {visit.servantName || t("common.notAssigned")}
                </small>
              </span>
              <Badge tone={visit.status === "completed" ? "ok" : visit.status === "cancelled" ? "muted" : "warn"}>
                {VISIT_STATUS_KEYS[visit.status]
                  ? t(VISIT_STATUS_KEYS[visit.status] as Parameters<typeof t>[0])
                  : visit.status}
              </Badge>
              {visit.followUpDate ? (
                <small style={{ color: "var(--mute)" }}>
                  {t("tabs.followUpOn", { date: formatDateFor(visit.followUpDate, locale) })}
                </small>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
