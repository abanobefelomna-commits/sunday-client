"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Baby,
  CalendarCheck,
  CheckCircle2,
  HeartHandshake,
  Sparkles,
  Users,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { MotionGroup, MotionInView, MotionItem } from "../components/motion";
import {
  Badge,
  EmptyState,
  MiniBars,
  PageHeader,
  ProgressRing,
  SkeletonCards,
  SkeletonRows,
  StatCard,
} from "../components/ui";
import {
  getAnalyticsOverview,
  getClasses,
  getFollowUps,
  getNews,
  getStoredUser,
  type AnalyticsOverview,
  type AuthUser,
  type ClassItem,
  type FollowUpCase,
  type FollowUpListResponse,
  type NewsItem,
} from "../lib/api";
import {
  followUpTone,
  priorityTone,
  shiftIso,
  todayIso,
} from "../lib/format";
import { useI18n, type AppMessageKey } from "../lib/app-i18n";

export default function DashboardPage() {
  const { t, number, percent, locale } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpListResponse | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12
        ? t("dashboard.greetingMorning")
        : hour < 18
          ? t("dashboard.greetingAfternoon")
          : t("dashboard.greetingEvening"),
    );
    setTodayLabel(
      new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    );
  }, [locale, t]);

  useEffect(() => {
    const today = todayIso();
    const from = shiftIso(today, -29);

    Promise.allSettled([
      getAnalyticsOverview({ from, to: today }),
      getFollowUps({ status: "active", limit: 6, overdue: false }),
      getNews("", 1, 3),
      getClasses(),
    ]).then(([resAnalytics, resFollowUps, resNews, resClasses]) => {
      if (resAnalytics.status === "fulfilled") setAnalytics(resAnalytics.value);
      if (resFollowUps.status === "fulfilled") setFollowUps(resFollowUps.value);
      if (resNews.status === "fulfilled") setNews(resNews.value.data);
      if (resClasses.status === "fulfilled") setClasses(resClasses.value);
      setLoading(false);
    });
  }, []);

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        day: "numeric",
        month: "short",
      }),
    [locale],
  );

  const weekly = useMemo(
    () =>
      (analytics?.weekly ?? []).slice(-6).map((row) => ({
        label: shortDate.format(new Date(row.bucket)),
        value: row.rate ?? 0,
        hint: `${shortDate.format(new Date(row.bucket))} — ${percent(row.rate)}`,
      })),
    [analytics, percent, shortDate],
  );

  const activeCases = followUps?.data ?? [];
  const summary = followUps?.meta.summary ?? {
    open: 0,
    inProgress: 0,
    overdue: 0,
    resolved: 0,
    total: 0,
  };
  const attendanceRate = analytics?.totals.attendanceRate ?? null;
  const students = analytics?.totals.students ?? 0;
  const displayName = user?.name?.replace(/^أ\.\s*/, "") || t("dashboard.defaultUser");

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("dashboard.eyebrow")}
            </>
          }
          title={t("dashboard.greeting", { greeting, name: displayName })}
          subtitle={t("dashboard.subtitle", { date: todayLabel })}
          actions={
            <>
              <Link href="/attendance" className="btn sm">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                {t("dashboard.attendanceAction")}
              </Link>
              <Link href="/follow-ups" className="btn ghost sm">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                {t("dashboard.followUpsAction")}
              </Link>
            </>
          }
        />

        <MotionInView as="section" className="hero-inner-card" ariaLabel={t("dashboard.summaryAria")}>
          <span className="eyebrow" style={{ color: "rgba(255,255,255,.82)" }}>
            {t("dashboard.heroEyebrow")}
          </span>
          <h2>{t("dashboard.heroTitle")}</h2>
          <p>{t("dashboard.heroBody")}</p>
          <div className="hero-chips">
            <span>
              <Baby className="h-3.5 w-3.5" aria-hidden="true" />
              {t("dashboard.studentsChip", { count: number(students) })}
            </span>
            <span>
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t("dashboard.classesChip", { count: number(analytics?.totals.activeClasses ?? classes.length) })}
            </span>
            <span>
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              {t("dashboard.activeFollowUpsChip", { count: number(summary.open + summary.inProgress) })}
            </span>
            {summary.overdue > 0 ? (
              <span>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("dashboard.overdueChip", { count: number(summary.overdue) })}
              </span>
            ) : null}
          </div>
        </MotionInView>

        {loading ? (
          <SkeletonCards count={4} />
        ) : (
          <MotionGroup as="section" className="kpi-grid" ariaLabel={t("dashboard.kpiAria")} amount={0.1}>
            <MotionItem className="kpi-grid-item">
              <StatCard
                label={t("dashboard.registeredStudents")}
                value={number(students)}
                hint={t("dashboard.studentsWithAttendance", { count: number(analytics?.totals.childrenWithAttendance ?? 0) })}
                icon={<Baby className="h-4 w-4" />}
                color="var(--pri)"
              />
            </MotionItem>
            <MotionItem className="kpi-grid-item">
              <StatCard
                label={t("dashboard.attendanceRate30")}
                value={percent(attendanceRate)}
                hint={t("dashboard.attendanceRecords", { count: number(analytics?.totals.recordedRecords ?? 0) })}
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="var(--ok)"
              />
            </MotionItem>
            <MotionItem className="kpi-grid-item">
              <StatCard
                label={t("dashboard.activeFollowUps")}
                value={number(summary.open + summary.inProgress)}
                hint={t("dashboard.followUpsBreakdown", {
                  open: number(summary.open),
                  progress: number(summary.inProgress),
                })}
                icon={<HeartHandshake className="h-4 w-4" />}
                color="var(--warn)"
              />
            </MotionItem>
            <MotionItem className="kpi-grid-item">
              <StatCard
                label={t("dashboard.overdueFollowUps")}
                value={number(summary.overdue)}
                hint={summary.overdue > 0 ? t("dashboard.needsAttention") : t("dashboard.noOverdue")}
                icon={<AlertTriangle className="h-4 w-4" />}
                color="var(--danger)"
              />
            </MotionItem>
          </MotionGroup>
        )}

        <div className="two-col">
          <div className="stack">
            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("dashboard.weeklyTrend")}>
              <div className="surface-head">
                <div>
                  <h2>{t("dashboard.weeklyTrend")}</h2>
                  <p>{t("dashboard.weeklyTrendHint")}</p>
                </div>
                <Link href="/analytics" className="link-quiet">
                  {t("nav.analytics")} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {loading ? (
                <div className="skel" style={{ height: 150 }} />
              ) : weekly.length > 0 && analytics?.totals.recordedRecords ? (
                <>
                  <MiniBars data={weekly} height={150} />
                  <div className="legend">
                    <span>
                      <i style={{ ["--l-color" as string]: "var(--pri)" }} /> {t("dashboard.attendanceLegend")}
                    </span>
                    <span>
                      <i style={{ ["--l-color" as string]: "var(--warn)" }} /> {t("dashboard.excusedLegend")}
                    </span>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="📊"
                  title={t("dashboard.noAttendance")}
                  description={t("dashboard.noAttendanceBody")}
                  action={
                    <Link href="/attendance" className="btn sm">
                      {t("dashboard.recordAttendance")}
                    </Link>
                  }
                />
              )}
            </MotionInView>

            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("dashboard.needsFollowUp")} delay={0.06}>
              <div className="surface-head">
                <div>
                  <h2>{t("dashboard.needsFollowUp")}</h2>
                  <p>{t("dashboard.needsFollowUpHint")}</p>
                </div>
                <Link href="/follow-ups" className="link-quiet">
                  {t("common.viewAll")} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {loading ? (
                <SkeletonRows rows={4} height={58} />
              ) : activeCases.length > 0 ? (
                <div className="list-stack">
                  {activeCases.map((item) => (
                    <FollowUpRow key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="🕊️"
                  title={t("dashboard.noActiveFollowUps")}
                  description={t("dashboard.noActiveFollowUpsBody")}
                  action={
                    <Link href="/follow-ups" className="btn ghost sm">
                      {t("dashboard.manageRules")}
                    </Link>
                  }
                />
              )}
            </MotionInView>
          </div>

          <div className="stack">
            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("dashboard.careSummary")}>
              <div className="surface-head">
                <div>
                  <h2>{t("dashboard.careSummary")}</h2>
                  <p>{t("dashboard.last30")}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <ProgressRing
                  value={attendanceRate}
                  caption={t("dashboard.attendanceRate")}
                  color={
                    attendanceRate === null
                      ? "var(--mute)"
                      : attendanceRate >= 85
                        ? "var(--ok)"
                        : attendanceRate >= 70
                          ? "var(--warn)"
                          : "var(--danger)"
                  }
                />
                <div className="stack-sm" style={{ flex: 1, minWidth: 150 }}>
                  <MetricRow label={t("dashboard.present")} value={analytics?.distribution.present ?? 0} tone="var(--ok)" />
                  <MetricRow label={t("dashboard.absent")} value={analytics?.distribution.absent ?? 0} tone="var(--danger)" />
                  <MetricRow label={t("dashboard.late")} value={analytics?.distribution.late ?? 0} tone="var(--warn)" />
                  <MetricRow label={t("dashboard.excused")} value={analytics?.distribution.excused ?? 0} tone="var(--violet)" />
                </div>
              </div>
              <div className="divider" style={{ margin: "16px 0" }} />
              <div className="stack-sm">
                <MetricRow
                  label={t("dashboard.unassignedFollowUps")}
                  value={analytics?.followUps.unassignedCases ?? 0}
                  tone="var(--warn)"
                />
                <MetricRow
                  label={t("dashboard.resolvedThisMonth")}
                  value={analytics?.followUps.resolvedInRange ?? 0}
                  tone="var(--ok)"
                />
                <MetricRow
                  label={t("dashboard.careActivities")}
                  value={analytics?.followUps.activitiesInRange ?? 0}
                  tone="var(--pri)"
                />
              </div>
            </MotionInView>

            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("dashboard.latestNews")} delay={0.06}>
              <div className="surface-head">
                <div>
                  <h2>{t("dashboard.latestNews")}</h2>
                  <p>{t("dashboard.latestNewsHint")}</p>
                </div>
                <Link href="/news" className="link-quiet">
                  {t("common.all")} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {news.length > 0 ? (
                <div className="stack-sm">
                  {news.map((item) => (
                    <Link key={item.id} href="/news" className="listrow">
                      <span className="avatar-md" aria-hidden="true">
                        📰
                      </span>
                      <span className="grow">
                        <b>{item.title || item.content.slice(0, 40)}</b>
                        <small>{shortDate.format(new Date(item.createdAt))}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon="📰" title={t("dashboard.noNews")} description={t("dashboard.noNewsBody")} />
              )}
            </MotionInView>

            <MotionInView as="section" className="surface surface-pad" ariaLabel={t("dashboard.classes")} delay={0.1}>
              <div className="surface-head">
                <div>
                  <h2>{t("dashboard.classes")}</h2>
                  <p>{t("dashboard.classesHint")}</p>
                </div>
                <Link href="/classes" className="link-quiet">
                  {t("common.all")} <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {(analytics?.classes ?? []).length > 0 ? (
                <div className="stack-sm">
                  {(analytics?.classes ?? []).slice(0, 5).map((item) => (
                    <Link key={item.id} href={`/classes/${item.id}`} className="listrow">
                      <span className="avatar-md" aria-hidden="true">
                        <Baby className="h-5 w-5" />
                      </span>
                      <span className="grow">
                        <b>{item.name}</b>
                        <small>
                          {t("dashboard.studentsMeta", {
                            students: number(item.students),
                            followUps: number(item.openFollowUps),
                          })}
                        </small>
                      </span>
                      <Badge tone={item.rate === null ? "muted" : item.rate >= 85 ? "ok" : item.rate >= 70 ? "warn" : "danger"}>
                        {percent(item.rate)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon="🏫" title={t("dashboard.noClasses")} description={t("dashboard.noClassesBody")} />
              )}
            </MotionInView>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { number } = useI18n();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--mute)", fontSize: ".84rem" }}>
        <i style={{ width: 8, height: 8, borderRadius: 3, background: tone }} aria-hidden="true" />
        {label}
      </span>
      <b style={{ fontSize: ".98rem" }}>{number(value)}</b>
    </div>
  );
}

function FollowUpRow({ item }: { item: FollowUpCase }) {
  const { t } = useI18n();
  const statusKey = `status.${item.status}` as AppMessageKey;
  const priorityKey = `priority.${item.priority}` as AppMessageKey;

  return (
    <Link href={`/follow-ups/${item.id}`} className="listrow">
      <span className="avatar-md" aria-hidden="true">
        {item.child.name.charAt(0)}
      </span>
      <span className="grow">
        <b>{item.child.name}</b>
        <small>{item.reason}</small>
      </span>
      <span style={{ display: "grid", gap: 4, justifyItems: "end" }}>
        <Badge tone={followUpTone(item.status)} dot>
          {t(statusKey)}
        </Badge>
        <Badge tone={priorityTone(item.priority)}>{t(priorityKey)}</Badge>
      </span>
      {item.isOverdue ? (
        <Badge tone="danger">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {t("dashboard.overdueFollowUps")}
        </Badge>
      ) : null}
      <BarChart3 className="h-4 w-4 opacity-30" aria-hidden="true" />
    </Link>
  );
}
