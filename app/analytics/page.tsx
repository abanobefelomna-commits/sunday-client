"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Baby,
  CalendarCheck,
  HeartHandshake,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { MotionGroup, MotionInView, MotionItem } from "../components/motion";
import {
  Badge,
  EmptyState,
  MiniBars,
  Notice,
  PageHeader,
  ProgressRing,
  SkeletonCards,
  SkeletonRows,
  StatCard,
} from "../components/ui";
import {
  getAnalyticsOverview,
  getClasses,
  type AnalyticsOverview,
  type ClassItem,
} from "../lib/api";
import { shiftIso, todayIso } from "../lib/format";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";

const RANGES: Array<{ key: number; labelKey: AppMessageKey }> = [
  { key: 30, labelKey: "analytics.range30" },
  { key: 90, labelKey: "analytics.range90" },
  { key: 180, labelKey: "analytics.range180" },
  { key: 365, labelKey: "analytics.range365" },
];

const ATTENDANCE_ROWS = [
  { status: "present", color: "var(--ok)", labelKey: "attendance.present" },
  { status: "late", color: "var(--warn)", labelKey: "attendance.late" },
  { status: "excused", color: "var(--violet)", labelKey: "attendance.excused" },
  { status: "absent", color: "var(--danger)", labelKey: "attendance.absent" },
] as const;

function parseBucket(bucket: string): Date {
  return new Date(bucket.length <= 10 ? `${bucket}T00:00:00Z` : bucket);
}

export default function AnalyticsPage() {
  const { t, number, percent, tag } = useI18n();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classId, setClassId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [tag],
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(tag, {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    [tag],
  );

  const load = useCallback(async () => {
    if (!from || !to) return;
    await Promise.resolve();
    try {
      const [resOverview, resClasses] = await Promise.all([
        getAnalyticsOverview({
          from,
          to,
          classId: classId === "all" ? undefined : classId,
        }),
        getClasses(),
      ]);
      setOverview(resOverview);
      setClasses(resClasses);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("analytics.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [from, to, classId, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = todayIso();
      setFrom(shiftIso(today, -89));
      setTo(today);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const applyRange = (days: number) => {
    setFrom(shiftIso(todayIso(), -(days - 1)));
    setTo(todayIso());
  };

  const activeRangeDays = useMemo(() => {
    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T00:00:00Z`).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  }, [from, to]);

  const totals = overview?.totals;
  const distribution = overview?.distribution;
  const followUps = overview?.followUps;
  const hasRecords = (totals?.recordedRecords ?? 0) > 0;

  const weeklyBars = useMemo(
    () =>
      (overview?.weekly ?? []).slice(-14).map((item) => {
        const label = shortDate.format(parseBucket(item.bucket));
        return {
          label,
          value: item.total,
          hint: `${label} — ${t("analytics.recordsUnit", { count: number(item.total) })}`,
        };
      }),
    [overview, shortDate, t, number],
  );

  const monthlyBars = useMemo(
    () =>
      (overview?.monthly ?? []).map((item) => {
        const label = monthLabel.format(parseBucket(item.bucket));
        return {
          label,
          value: item.total,
          hint: `${label} — ${t("analytics.recordsUnit", { count: number(item.total) })}`,
        };
      }),
    [overview, monthLabel, t, number],
  );

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg analytics-page">
        <MotionInView>
          <PageHeader
            eyebrow={
              <>
                <BarChart3 className="h-4 w-4" aria-hidden="true" /> {t("analytics.eyebrow")}
              </>
            }
            title={t("analytics.pageTitle")}
            subtitle={t("analytics.pageSubtitle")}
            actions={
              <button type="button" className="btn ghost sm" onClick={load} disabled={loading}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("common.refresh")}
              </button>
            }
          />
        </MotionInView>

        <MotionInView as="section" className="surface surface-pad" ariaLabel={t("analytics.filtersAria")} delay={0.04}>
          <div className="filters" style={{ marginBottom: 0 }}>
            <div className="grow-wrap">
              {RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  className={`chip ${activeRangeDays === range.key ? "on" : ""}`}
                  onClick={() => applyRange(range.key)}
                  aria-pressed={activeRangeDays === range.key}
                >
                  {t(range.labelKey)}
                </button>
              ))}
            </div>

            <label className="fld" style={{ minWidth: 150 }}>
              <span className="sr-only">{t("analytics.fromDate")}</span>
              <input
                type="date"
                value={from}
                max={to ?? undefined}
                onChange={(event) => setFrom(event.target.value)}
                aria-label={t("analytics.fromDate")}
              />
            </label>

            <label className="fld" style={{ minWidth: 150 }}>
              <span className="sr-only">{t("analytics.toDate")}</span>
              <input
                type="date"
                value={to}
                min={from ?? undefined}
                onChange={(event) => setTo(event.target.value)}
                aria-label={t("analytics.toDate")}
              />
            </label>

            <label className="fld" style={{ minWidth: 170 }}>
              <span className="sr-only">{t("analytics.class")}</span>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                aria-label={t("analytics.filterClass")}
              >
                <option value="all">{t("analytics.allClasses")}</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </MotionInView>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {loading && !overview ? (
          <>
            <SkeletonCards count={4} />
            <div className="surface surface-pad">
              <SkeletonRows rows={4} height={70} />
            </div>
          </>
        ) : null}

        {overview && totals && distribution && followUps ? (
          <>
            {!hasRecords ? (
              <Notice tone="warn">
                <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
                <span>
                  {t("analytics.noRecords", {
                    from: shortDate.format(parseBucket(from)),
                    to: shortDate.format(parseBucket(to)),
                  })}
                </span>
              </Notice>
            ) : null}

            <MotionGroup as="section" className="kpi-grid" ariaLabel={t("analytics.kpiAria")} delay={0.06} amount={0.1}>
              <MotionItem className="kpi-grid-item">
                <StatCard
                  label={t("analytics.attendanceRate")}
                  value={percent(totals.attendanceRate)}
                  hint={t("analytics.attendanceHint", {
                    present: number(distribution.present + distribution.late),
                    total: number(distribution.total),
                  })}
                  icon={<TrendingUp className="h-4 w-4" />}
                  color="var(--ok)"
                />
              </MotionItem>
              <MotionItem className="kpi-grid-item">
                <StatCard
                  label={t("analytics.records")}
                  value={number(totals.recordedRecords)}
                  hint={t("analytics.recordsHint", {
                    sessions: number(totals.attendanceSessions),
                    children: number(totals.childrenWithAttendance),
                  })}
                  icon={<CalendarCheck className="h-4 w-4" />}
                  color="var(--pri)"
                />
              </MotionItem>
              <MotionItem className="kpi-grid-item">
                <StatCard
                  label={t("analytics.childrenClasses")}
                  value={`${number(totals.students)} / ${number(totals.activeClasses)}`}
                  hint={t("analytics.childrenClassesHint")}
                  icon={<Baby className="h-4 w-4" />}
                  color="var(--violet)"
                />
              </MotionItem>
              <MotionItem className="kpi-grid-item">
                <StatCard
                  label={t("analytics.openFollowUps")}
                  value={number(followUps.workload)}
                  hint={t("analytics.openFollowUpsHint", {
                    overdue: number(followUps.overdueCases),
                    children: number(followUps.childrenWithOpenCases),
                  })}
                  icon={<HeartHandshake className="h-4 w-4" />}
                  color="var(--danger)"
                />
              </MotionItem>
            </MotionGroup>

            <div className="two-col">
              <MotionInView as="section" className="surface surface-pad" ariaLabel={t("analytics.distribution")}>
                <div className="surface-head">
                  <div>
                    <h2>{t("analytics.distribution")}</h2>
                    <p>{t("analytics.distributionHint2")}</p>
                  </div>
                  <ProgressRing
                    value={totals.attendanceRate}
                    caption={t("analytics.attendanceRate")}
                    color={
                      totals.attendanceRate === null
                        ? "var(--mute)"
                        : totals.attendanceRate >= 85
                          ? "var(--ok)"
                          : totals.attendanceRate >= 70
                            ? "var(--warn)"
                            : "var(--danger)"
                    }
                  />
                </div>

                {distribution.total === 0 ? (
                  <EmptyState
                    icon={<CalendarCheck className="h-5 w-5" />}
                    title={t("analytics.noRecordsInPeriod")}
                    description={t("analytics.noRecordsInPeriodBody")}
                    action={
                      <Link href="/attendance" className="btn ghost sm">
                        {t("dashboard.recordAttendance")}
                      </Link>
                    }
                  />
                ) : (
                  <div className="stack-sm">
                    {ATTENDANCE_ROWS.map(({ status, color, labelKey }) => {
                      const value = distribution[status];
                      const share =
                        distribution.total > 0 ? Math.round((value / distribution.total) * 100) : 0;
                      return (
                        <div key={status}>
                          <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: ".88rem", fontWeight: 700 }}>{t(labelKey)}</span>
                            <span style={{ fontSize: ".82rem", color: "var(--mute)" }}>
                              {number(value)} · {percent(share)}
                            </span>
                          </div>
                          <div
                            role="img"
                            aria-label={t("analytics.recordAria", {
                              status: t(labelKey),
                              value: number(value),
                              total: number(distribution.total),
                            })}
                            style={{
                              height: 10,
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--mute) 14%, transparent)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${share}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: color,
                                transition: "width .3s",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </MotionInView>

              <MotionInView
                as="section"
                className="surface surface-pad"
                ariaLabel={t("analytics.careStateAria")}
                delay={0.06}
              >
                <div className="surface-head">
                  <div>
                    <h2>{t("analytics.careTitle")}</h2>
                    <p>{t("analytics.careHint")}</p>
                  </div>
                </div>
                <div className="stack-sm">
                  <FollowRow label={t("analytics.careOpen")} value={followUps.openCases} tone="danger" />
                  <FollowRow label={t("analytics.careInProgress")} value={followUps.inProgressCases} tone="warn" />
                  <FollowRow label={t("analytics.careOverdue")} value={followUps.overdueCases} tone="violet" />
                  <FollowRow label={t("analytics.careResolved")} value={followUps.resolvedInRange} tone="ok" />
                  <FollowRow label={t("analytics.careUnassigned")} value={followUps.unassignedCases} tone="muted" />
                  <FollowRow label={t("analytics.careActivities")} value={followUps.activitiesInRange} tone="pri" />
                </div>
                <Link href="/follow-ups" className="btn ghost sm" style={{ marginTop: 14, justifyContent: "center" }}>
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" /> {t("analytics.openFollowUpsAction")}
                </Link>
              </MotionInView>
            </div>

            <div className="two-col">
              <MotionInView
                as="section"
                className="surface surface-pad"
                ariaLabel={t("analytics.weeklyAria")}
                delay={0.08}
              >
                <div className="surface-head">
                  <div>
                    <h2>{t("analytics.weeklyTitle")}</h2>
                    <p>{t("analytics.weeklyHint")}</p>
                  </div>
                  <Badge tone="muted">{t("analytics.lastWeeks", { count: number(weeklyBars.length) })}</Badge>
                </div>
                {weeklyBars.length === 0 || distribution.total === 0 ? (
                  <EmptyState title={t("analytics.noTrend")} description={t("analytics.noTrendBody")} />
                ) : (
                  <MiniBars data={weeklyBars} height={150} />
                )}
              </MotionInView>

              <MotionInView
                as="section"
                className="surface surface-pad"
                ariaLabel={t("analytics.monthlyAria")}
                delay={0.1}
              >
                <div className="surface-head">
                  <div>
                    <h2>{t("analytics.monthlyTitle")}</h2>
                    <p>{t("analytics.monthlyHint")}</p>
                  </div>
                </div>
                {monthlyBars.length === 0 || distribution.total === 0 ? (
                  <EmptyState title={t("analytics.noTrend")} description={t("analytics.noTrendBody")} />
                ) : (
                  <MiniBars data={monthlyBars} height={150} />
                )}
              </MotionInView>
            </div>

            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("analytics.classCompareAria")} delay={0.12}>
              <div className="surface-head">
                <div>
                  <h2>{t("analytics.classPerformance")}</h2>
                  <p>{t("analytics.classPerformanceHint2")}</p>
                </div>
                <Badge tone="muted">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                  {t("analytics.classCount", { count: number(overview.classes.length) })}
                </Badge>
              </div>

              {overview.classes.length === 0 ? (
                <EmptyState title={t("dashboard.noClasses")} description={t("analytics.noClassesBody")} />
              ) : (
                <div className="table-wrap analytics-table-wrap">
                  <table className="data analytics-table">
                    <caption className="sr-only">{t("analytics.tableCaption")}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t("analytics.colClass")}</th>
                        <th scope="col">{t("analytics.colChildren")}</th>
                        <th scope="col">{t("analytics.colRecords")}</th>
                        <th scope="col">{t("analytics.colRate")}</th>
                        <th scope="col">{t("analytics.colAbsent")}</th>
                        <th scope="col">{t("analytics.colOpen")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.classes.map((item) => (
                        <tr key={item.id}>
                          <th scope="row" data-label={t("analytics.colClass")} style={{ fontWeight: 800 }}>
                            {item.name}
                          </th>
                          <td data-label={t("analytics.colChildren")}>{number(item.students)}</td>
                          <td data-label={t("analytics.colRecords")}>{number(item.total)}</td>
                          <td data-label={t("analytics.colRate")}>
                            <div className="grow-wrap" style={{ gap: 8 }}>
                              <span style={{ minWidth: 42 }}>{percent(item.rate)}</span>
                              <span
                                aria-hidden="true"
                                style={{
                                  display: "inline-block",
                                  width: 72,
                                  height: 8,
                                  borderRadius: 999,
                                  background: "color-mix(in srgb, var(--mute) 15%, transparent)",
                                  overflow: "hidden",
                                }}
                              >
                                <span
                                  style={{
                                    display: "block",
                                    width: `${Math.max(0, Math.min(100, item.rate ?? 0))}%`,
                                    height: "100%",
                                    background:
                                      item.rate === null
                                        ? "var(--mute)"
                                        : item.rate >= 85
                                          ? "var(--ok)"
                                          : item.rate >= 70
                                            ? "var(--warn)"
                                            : "var(--danger)",
                                  }}
                                />
                              </span>
                            </div>
                          </td>
                          <td data-label={t("analytics.colAbsent")}>{number(item.absent)}</td>
                          <td data-label={t("analytics.colOpen")}>
                            {item.openFollowUps > 0 ? (
                              <Badge tone="danger">{number(item.openFollowUps)}</Badge>
                            ) : (
                              <Badge tone="ok">{t("analytics.none")}</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </MotionInView>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}

function FollowRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { number } = useI18n();
  return (
    <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
      <span style={{ fontSize: ".88rem" }}>{label}</span>
      <Badge tone={tone}>{number(value)}</Badge>
    </div>
  );
}
