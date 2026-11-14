"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Filter,
  HeartHandshake,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  Badge,
  EmptyState,
  Modal,
  Notice,
  PageHeader,
  SkeletonRows,
  StatCard,
} from "../components/ui";
import {
  createFollowUp,
  evaluateFollowUps,
  getChildren,
  getClasses,
  getFollowUps,
  getFollowUpRules,
  getStoredUser,
  updateFollowUpRule,
  type AuthUser,
  type ChildItem,
  type ClassItem,
  type FollowUpCase,
  type FollowUpListResponse,
  type FollowUpPriority,
  type FollowUpRule,
  type FollowUpStatus,
} from "../lib/api";
import {
  followUpTone,
  formatDateFor,
  initials,
  priorityTone,
  shiftIso,
  todayIso,
} from "../lib/format";
import { useI18n } from "../lib/app-i18n";

type StatusFilter = FollowUpStatus | "active" | "all";

export default function FollowUpsPage() {
  const { t, locale, number } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<FollowUpListResponse | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState<StatusFilter>("active");
  const [priority, setPriority] = useState<FollowUpPriority | "all">("all");
  const [classId, setClassId] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    created: number;
    flagged: number;
    skipped: number;
    evaluatedStudents: number;
  } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const [resCases, resClasses] = await Promise.all([
        getFollowUps({
          status: status === "all" ? undefined : status,
          classId: classId === "all" ? undefined : classId,
          priority: priority === "all" ? undefined : priority,
          search: debounced || undefined,
          overdue,
          page,
          limit: 20,
        }),
        getClasses(),
      ]);
      setData(resCases);
      setClasses(resClasses);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("followUps.loadError"));
    } finally {
      setLoading(false);
    }
  }, [status, classId, priority, debounced, overdue, page]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.meta.summary ?? { open: 0, inProgress: 0, overdue: 0, resolved: 0, total: 0 };
  const totalPages = data?.meta.totalPages ?? 1;
  const cases = data?.data ?? [];

  const isManager = useMemo(
    () =>
      !!user &&
      (["admin", "priest"].includes(user.role) ||
        ["مسؤول", "أب كاهن"].includes(user.servantRole || "")),
    [user],
  );

  const runEvaluation = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const result = await evaluateFollowUps({
        classId: classId === "all" ? undefined : classId,
        dryRun,
      });
      setEvaluation({
        created: result.created,
        flagged: result.flagged,
        skipped: result.skipped,
        evaluatedStudents: result.evaluatedStudents,
      });
      if (!dryRun) await load();
      showToast(
        dryRun
          ? t("followUps.toastDry", { count: number(result.alerts.length) })
          : t("followUps.toastCreated", { count: number(result.created) }),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("followUps.toastFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <HeartHandshake className="h-4 w-4" aria-hidden="true" /> {t("followUps.eyebrow")}
            </>
          }
          title={t("nav.followUps")}
          subtitle={t("followUps.subtitle")}
          actions={
            <>
              <button type="button" className="btn ghost sm" onClick={() => setRulesOpen(true)}>
                <Settings2 className="h-4 w-4" aria-hidden="true" /> {t("followUps.rules")}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => runEvaluation(true)} disabled={busy}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("followUps.dryRun")}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => runEvaluation(false)} disabled={busy}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("followUps.runNow")}
              </button>
              <button type="button" className="btn sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("followUps.manual")}
              </button>
            </>
          }
        />

        <section className="kpi-grid" aria-label={t("followUps.summaryAria")}>
          <StatCard
            label={t("followUps.open")}
            value={number(summary.open)}
            hint={t("followUps.openHint")}
            icon={<HeartHandshake className="h-4 w-4" />}
            color="var(--danger)"
          />
          <StatCard
            label={t("followUps.inProgress")}
            value={number(summary.inProgress)}
            hint={t("followUps.inProgressHint")}
            icon={<PlayCircle className="h-4 w-4" />}
            color="var(--warn)"
          />
          <StatCard
            label={t("followUps.overdueTitle")}
            value={number(summary.overdue)}
            hint={t("followUps.overdueHint")}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="var(--violet)"
          />
          <StatCard
            label={t("followUps.closed")}
            value={number(summary.resolved)}
            hint={t("followUps.closedHint")}
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="var(--ok)"
          />
        </section>

        {evaluation ? (
          <Notice tone={evaluation.created > 0 ? "warn" : "default"}>
            <Sparkles className="h-4 w-4 flex-none" aria-hidden="true" />
            <span>
              {t("followUps.evaluation", {
                evaluated: number(evaluation.evaluatedStudents),
                created: number(evaluation.created),
                skipped: number(evaluation.skipped),
                flagged: number(evaluation.flagged),
              })}
            </span>
          </Notice>
        ) : null}

        <section className="surface surface-pad stack">
          <div className="tabs2" role="tablist" aria-label={t("followUps.filterAria")}>
            {(
              [
                ["active", t("followUps.tabActive")],
                ["all", t("followUps.tabAll")],
                ["open", t("followUps.tabOpen")],
                ["in_progress", t("followUps.tabInProgress")],
                ["resolved", t("followUps.tabResolved")],
                ["dismissed", t("followUps.tabDismissed")],
              ] as Array<[StatusFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="filters">
            <label className="sb" style={{ flex: 1, minWidth: 220 }}>
              <Search className="h-4 w-4 opacity-50" aria-hidden="true" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("followUps.searchPlaceholder")}
                aria-label={t("followUps.searchAria")}
              />
            </label>

            <label className="fld" style={{ minWidth: 150 }}>
              <span className="sr-only">{t("common.class")}</span>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setPage(1);
                }}
                aria-label={t("followUps.classAria")}
              >
                <option value="all">{t("common.allClasses")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="fld" style={{ minWidth: 140 }}>
              <span className="sr-only">{t("common.priority")}</span>
              <select
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value as FollowUpPriority | "all");
                  setPage(1);
                }}
                aria-label={t("followUps.priorityAria")}
              >
                <option value="all">{t("followUps.allPriorities")}</option>
                <option value="high">{t("priority.high")}</option>
                <option value="medium">{t("priority.medium")}</option>
                <option value="low">{t("priority.low")}</option>
              </select>
            </label>

            <button
              type="button"
              className={`chip ${overdue ? "on" : ""}`}
              onClick={() => {
                setOverdue((value) => !value);
                setPage(1);
              }}
              aria-pressed={overdue}
            >
              <Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> {t("followUps.overdueOnly")}
            </button>
          </div>

          {error ? <Notice tone="danger">{error}</Notice> : null}

          {loading ? (
            <SkeletonRows rows={6} height={90} />
          ) : cases.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake className="h-5 w-5" />}
              title={t("followUps.noResults")}
              description={t("followUps.noResultsHint")}
              action={
                <button type="button" className="btn ghost sm" onClick={() => setRulesOpen(true)}>
                  {t("followUps.manageRules")}
                </button>
              }
            />
          ) : (
            <div className="list-stack">
              {cases.map((item) => (
                <CaseRow key={item.id} item={item} />
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="grow-wrap" style={{ justifyContent: "center" }} aria-label={t("common.paginationAria")}>
              <button type="button" className="btn ghost sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
                {t("common.prev")}
              </button>
              <span style={{ fontSize: ".85rem", color: "var(--mute)" }}>
                {t("common.pageOf", { page: number(page), total: number(totalPages) })}
              </span>
              <button type="button" className="btn ghost sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                {t("common.next")}
              </button>
            </nav>
          ) : null}
        </section>
      </main>

      {createOpen ? (
        <CreateCaseModal
          onClose={() => setCreateOpen(false)}
          onSaved={async () => {
            setCreateOpen(false);
            await load();
            showToast(t("followUps.toastManual"));
          }}
        />
      ) : null}

      {rulesOpen ? <RulesModal isManager={isManager} onClose={() => setRulesOpen(false)} onChanged={load} /> : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}

function CaseRow({ item }: { item: FollowUpCase }) {
  const { t, locale, number } = useI18n();
  return (
    <article className="surface" style={{ padding: 15 }}>
      <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <div className="grow-wrap">
          <Link href={`/children/${item.childId}`} className="grow-wrap" style={{ gap: 8 }}>
            <span className="avatar-md" aria-hidden="true">
              {initials(item.child.name)}
            </span>
            <b>{item.child.name}</b>
          </Link>
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

      <p style={{ margin: "0 0 8px", fontSize: ".9rem" }}>{item.reason}</p>

      <div className="grow-wrap" style={{ color: "var(--mute)", fontSize: ".8rem" }}>
        <span>
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {formatDateFor(item.dueDate, locale)}
        </span>
        <span>{item.class?.name || t("common.noClass")}</span>
        <span>{t("followUps.servant", { name: item.servant?.name || t("common.notAssigned") })}</span>
        <span>{t("followUps.activities", { count: number(item.activityCount) })}</span>
      </div>
    </article>
  );
}

function CreateCaseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [childId, setChildId] = useState("");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<FollowUpPriority>("medium");
  const [dueDate, setDueDate] = useState(shiftIso(todayIso(), 7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    getChildren({ search: search.trim() || undefined, limit: 50 })
      .then((res) => setChildren(res.data))
      .catch(() => setChildren([]));
  }, [search]);

  return (
    <Modal
      title={t("followUps.createTitle")}
      subtitle={t("followUps.createSubtitle")}
      onClose={onClose}
      wide
    >
      <form
        className="f"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!childId) {
            setError(t("followUps.requiredChild"));
            return;
          }
          if (!reason.trim()) {
            setError(t("followUps.requiredReason"));
            return;
          }
          setSaving(true);
          setError(null);
          try {
            await createFollowUp({
              childId,
              reason: reason.trim(),
              priority,
              dueDate: dueDate || null,
            });
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : t("followUps.createError"));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="fld full">
            <label htmlFor="case_search">{t("followUps.childSearch")}</label>
            <input
              id="case_search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("followUps.childSearchPlaceholder")}
              disabled={saving}
            />
          </div>
          <div className="fld full">
            <label htmlFor="case_child">{t("followUps.childLabel")}</label>
            <select
              id="case_child"
              value={childId}
              onChange={(event) => setChildId(event.target.value)}
              disabled={saving || children.length === 0}
            >
              <option value="">
                {children.length === 0 ? t("followUps.noChildren") : t("followUps.chooseChild")}
              </option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name} — {child.class?.name || t("common.noClass")}
                </option>
              ))}
            </select>
          </div>
          <div className="fld full">
            <label htmlFor="case_reason">{t("followUps.reasonLabel")}</label>
            <textarea
              id="case_reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("followUps.reasonPlaceholder")}
              disabled={saving}
            />
          </div>
          <div className="fld">
            <label htmlFor="case_priority">{t("common.priority")}</label>
            <select
              id="case_priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as FollowUpPriority)}
              disabled={saving}
            >
              <option value="low">{t("priority.low")}</option>
              <option value="medium">{t("priority.medium")}</option>
              <option value="high">{t("priority.high")}</option>
            </select>
          </div>
          <div className="fld">
            <label htmlFor="case_due">{t("followUps.dueLabel")}</label>
            <input
              id="case_due"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={saving}
            />
          </div>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t("followUps.opening") : t("followUps.openAction")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RulesModal({
  isManager,
  onClose,
  onChanged,
}: {
  isManager: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const load = useCallback(async () => {
    try {
      const res = await getFollowUpRules();
      setRules(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("followUps.rulesLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (rule: FollowUpRule, input: Partial<{ threshold: number; windowDays: number; isActive: boolean; priority: FollowUpPriority }>) => {
    setSavingId(rule.id);
    setError(null);
    try {
      await updateFollowUpRule(rule.id, input);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("followUps.ruleUpdateError"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Modal
      title={t("followUps.rulesTitle")}
      subtitle={t("followUps.rulesSubtitle")}
      onClose={onClose}
      wide
    >
      {!isManager ? (
        <Notice tone="warn">
          {t("followUps.rulesReadOnly")}
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {loading ? (
        <SkeletonRows rows={4} height={110} />
      ) : (
        <div className="stack-sm">
          {rules.map((rule) => (
            <article key={rule.id} className="surface" style={{ padding: 14 }}>
              <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
                <div>
                  <b>{rule.name}</b>
                  <p style={{ margin: "2px 0 0", color: "var(--mute)", fontSize: ".8rem" }}>
                    {rule.description}
                  </p>
                </div>
                <Badge tone={rule.isActive ? "ok" : "muted"} dot>
                  {rule.isActive ? t("common.enabled") : t("common.disabled")}
                </Badge>
              </div>

              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="fld">
                  <span>{t("followUps.ruleThreshold")}</span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={rule.threshold}
                    disabled={!isManager || savingId === rule.id}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value !== rule.threshold) patch(rule, { threshold: value });
                    }}
                  />
                </label>
                <label className="fld">
                  <span>{t("followUps.ruleWindow")}</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={rule.windowDays}
                    disabled={!isManager || savingId === rule.id}
                    onBlur={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value !== rule.windowDays) patch(rule, { windowDays: value });
                    }}
                  />
                </label>
                <label className="fld">
                  <span>{t("followUps.rulePriority")}</span>
                  <select
                    defaultValue={rule.priority}
                    disabled={!isManager || savingId === rule.id}
                    onChange={(event) => patch(rule, { priority: event.target.value as FollowUpPriority })}
                  >
                    <option value="low">{t("priority.low")}</option>
                    <option value="medium">{t("priority.medium")}</option>
                    <option value="high">{t("priority.high")}</option>
                  </select>
                </label>
                <label className="fld" style={{ justifyContent: "flex-end" }}>
                  <span>{t("followUps.ruleRun")}</span>
                  <button
                    type="button"
                    className={`chip ${rule.isActive ? "on" : ""}`}
                    disabled={!isManager || savingId === rule.id}
                    onClick={() => patch(rule, { isActive: !rule.isActive })}
                  >
                    {rule.isActive ? t("common.enabled") : t("common.disabled")}
                  </button>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="notice" style={{ marginTop: 14 }}>
        <Sparkles className="h-4 w-4 flex-none" aria-hidden="true" />
        <span>{t("followUps.ruleFooter")}</span>
      </div>
    </Modal>
  );
}
