"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  followUpTone,
  formatDateFor,
  formatDateTimeFor,
  priorityTone,
} from "../../lib/format";
import { useI18n } from "../../lib/app-i18n";

type ActivityType = "note" | "call" | "message" | "visit";

const ACTIVITY_META: Record<
  string,
  { labelKey: string; icon: React.ReactNode; tone: string }
> = {
  note: { labelKey: "followUpDetail.note", icon: <NotebookPen className="h-4 w-4" />, tone: "pri" },
  call: { labelKey: "followUpDetail.call", icon: <Phone className="h-4 w-4" />, tone: "violet" },
  message: { labelKey: "followUpDetail.message", icon: <MessageSquare className="h-4 w-4" />, tone: "warn" },
  visit: { labelKey: "followUpDetail.visit", icon: <Home className="h-4 w-4" />, tone: "ok" },
  status_change: { labelKey: "followUpDetail.statusChange", icon: <RefreshCw className="h-4 w-4" />, tone: "pri" },
  resolution: { labelKey: "followUpDetail.resolution", icon: <CheckCircle2 className="h-4 w-4" />, tone: "ok" },
  assignment: { labelKey: "followUpDetail.assignment", icon: <UserRound className="h-4 w-4" />, tone: "violet" },
};

export default function FollowUpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, locale } = useI18n();

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
      setError(err instanceof Error ? err.message : t("followUpDetail.loadError"));
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
          ? t("followUpDetail.closedToast")
          : status === "dismissed"
            ? t("followUpDetail.dismissedToast")
            : t("followUpDetail.updatedToast"),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("followUpDetail.failedToast"));
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
      showToast(t("followUpDetail.priorityUpdated"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("followUpDetail.priorityError"));
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
      showToast(t("followUpDetail.activityAdded"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("followUpDetail.activityError"));
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
          <Notice tone="danger">{error || t("followUpDetail.notFound")}</Notice>
          <Link href="/follow-ups" className="btn ghost sm" style={{ alignSelf: "flex-start" }}>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("followUpDetail.backAll")}
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
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" /> {t("followUpDetail.backAll")}
          </Link>
          <PageHeader
            eyebrow={
              <>
                <HeartHandshake className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.eyebrow")}
              </>
            }
            title={child.name}
            subtitle={
              followUp.source === "rule"
                ? t("followUpDetail.sourceRule")
                : followUp.source === "visitation"
                  ? t("followUpDetail.sourceVisitation")
                  : t("followUpDetail.sourceManual")
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
                    <PlayCircle className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.start")}
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
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.close")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      disabled={busy}
                      onClick={() => setDismissOpen(true)}
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.dismiss")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busy}
                    onClick={() => changeStatus("open")}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.reopen")}
                  </button>
                )}
              </>
            }
          />
        </div>

        <section className="surface surface-pad" aria-label={t("followUpDetail.summaryAria")}>
          <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div className="grow-wrap">
              <Badge tone={followUpTone(followUp.status)} dot>
                {t(`status.${followUp.status}`)}
              </Badge>
              <Badge tone={priorityTone(followUp.priority)}>{t(`priority.${followUp.priority}`)}</Badge>
              {followUp.isOverdue ? <Badge tone="danger">{t("common.overdue")}</Badge> : null}
              <Badge tone="muted">
                {followUp.source === "rule"
                  ? t("followUpDetail.sourceRuleBadge")
                  : followUp.source === "visitation"
                    ? t("followUpDetail.sourceVisitationBadge")
                    : t("followUpDetail.sourceManualBadge")}
              </Badge>
            </div>
            <Link href={`/children/${child.id}`} className="link-quiet">
              <UserRound className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.studentFile")}
            </Link>
          </div>

          <p style={{ margin: "0 0 14px", fontSize: "1rem", lineHeight: 1.8 }}>{followUp.reason}</p>

          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Meta label={t("common.class")} value={child.className || t("common.noClass")} icon={<Home className="h-3.5 w-3.5" />} />
            <Meta
              label={t("children.servantLabel")}
              value={followUp.servant?.name || t("common.notAssigned")}
              icon={<UserRound className="h-3.5 w-3.5" />}
            />
            <Meta
              label={t("followUpDetail.due")}
              value={followUp.dueDate ? formatDateFor(followUp.dueDate, locale) : t("common.notSet")}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
            />
            <Meta
              label={t("followUpDetail.lastActivity")}
              value={followUp.lastActivityAt ? formatDateTimeFor(followUp.lastActivityAt, locale) : t("followUpDetail.none")}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="grow-wrap" style={{ marginTop: 14 }}>
            <label className="fld" style={{ maxWidth: 220 }}>
              <span>{t("common.priority")}</span>
              <select
                value={followUp.priority}
                disabled={busy}
                onChange={(event) => changePriority(event.target.value as FollowUpPriority)}
                aria-label={t("followUpDetail.changePriorityAria")}
              >
                <option value="low">{t("priority.low")}</option>
                <option value="medium">{t("priority.medium")}</option>
                <option value="high">{t("priority.high")}</option>
              </select>
            </label>
            {active ? (
              <button type="button" className="btn sm" onClick={() => setActivityOpen(true)} disabled={busy}>
                <NotebookPen className="h-4 w-4" aria-hidden="true" /> {t("followUpDetail.logActivity")}
              </button>
            ) : null}
          </div>

          {followUp.resolutionNotes ? (
            <div className="notice" style={{ marginTop: 14 }}>
              <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
              <span>
                <b>{t("followUpDetail.resolutionNotes")}</b> {followUp.resolutionNotes}
                {followUp.resolvedAt ? ` — ${formatDateTimeFor(followUp.resolvedAt, locale)}` : ""}
              </span>
            </div>
          ) : null}
        </section>

        <section className="surface surface-pad" aria-label={t("followUpDetail.activityLog")}>
          <div className="surface-head" style={{ marginBottom: 14 }}>
            <div>
              <h2>{t("followUpDetail.activityLog")}</h2>
              <p>{t("followUpDetail.activityCount", { count: activities.length })}</p>
            </div>
          </div>

          {activities.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake className="h-5 w-5" />}
              title={t("followUpDetail.noActivities")}
              description={t("followUpDetail.noActivitiesHint")}
              action={
                active ? (
                  <button type="button" className="btn ghost sm" onClick={() => setActivityOpen(true)}>
                    {t("followUpDetail.firstActivity")}
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
          title={t("followUpDetail.closeTitle")}
          subtitle={t("followUpDetail.closeSubtitle")}
          confirmLabel={t("followUpDetail.closeConfirm")}
          busy={busy}
          required
          onClose={() => setResolveOpen(false)}
          onSubmit={(notes) => changeStatus("resolved", notes)}
        />
      ) : null}

      {dismissOpen ? (
        <NotesModal
          title={t("followUpDetail.dismissTitle")}
          subtitle={t("followUpDetail.dismissSubtitle")}
          confirmLabel={t("followUpDetail.dismissConfirm")}
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
  const { t, locale } = useI18n();
  return (
    <div className="timeline">
      {activities.map((activity) => {
        const meta = ACTIVITY_META[activity.type] ?? {
          labelKey: "",
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
                {formatDateTimeFor(activity.occurredAt, locale)}
                {activity.actorName ? ` · ${activity.actorName}` : ""}
                {meta.labelKey ? ` · ${t(meta.labelKey as Parameters<typeof t>[0])}` : ""}
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
  const { t } = useI18n();

  return (
    <Modal
      title={t("followUpDetail.activityModalTitle")}
      subtitle={t("followUpDetail.activityModalSubtitle")}
      onClose={onClose}
      wide
    >
      <form
        className="f"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) {
            setError(t("followUpDetail.requiredTitle"));
            return;
          }
          setError(null);
          onSubmit({ type, title: title.trim(), notes });
        }}
      >
        <div className="form-grid">
          <label className="fld">
            <span>{t("followUpDetail.activityType")}</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ActivityType)}
              disabled={busy}
            >
              <option value="call">{t("followUpDetail.call")}</option>
              <option value="message">{t("followUpDetail.message")}</option>
              <option value="visit">{t("followUpDetail.visit")}</option>
              <option value="note">{t("followUpDetail.note")}</option>
            </select>
          </label>
          <label className="fld">
            <span>{t("followUpDetail.titleLabel")}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("followUpDetail.titlePlaceholder")}
              maxLength={180}
              disabled={busy}
            />
          </label>
          <label className="fld full">
            <span>{t("followUpDetail.details")}</span>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("followUpDetail.detailsPlaceholder")}
              maxLength={2000}
              disabled={busy}
            />
          </label>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t("followUpDetail.savingActivity") : t("followUpDetail.saveActivity")}
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
  const { t } = useI18n();

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} wide>
      <form
        className="f"
        onSubmit={(event) => {
          event.preventDefault();
          if (required && !notes.trim()) {
            setError(t("followUpDetail.requiredNotes"));
            return;
          }
          setError(null);
          onSubmit(notes.trim());
        }}
      >
        <label className="fld full">
          <span>{required ? t("followUpDetail.closeNotesLabel") : t("followUpDetail.dismissReasonLabel")}</span>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            disabled={busy}
            placeholder={
              required
                ? t("followUpDetail.closeNotesPlaceholder")
                : t("followUpDetail.dismissReasonPlaceholder")
            }
          />
        </label>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t("common.savingShort") : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
