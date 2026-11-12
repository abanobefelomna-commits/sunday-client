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
import { MOTION, Reveal } from "../components/motion";
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
  FOLLOW_UP_STATUS_LABELS,
  formatShortDate,
  followUpTone,
  numberAr,
  percent,
  priorityTone,
  PRIORITY_LABELS,
  shiftIso,
  todayIso,
} from "../lib/format";

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpListResponse | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("");
  const [todayArabic, setTodayArabic] = useState("");

  useEffect(() => {
    Promise.resolve().then(() => {
      setUser(getStoredUser());
      const hour = new Date().getHours();
      setGreeting(hour < 12 ? "صباح الخير" : hour < 18 ? "أهلاً بيك" : "مساء الخير");
      setTodayArabic(
        new Date().toLocaleDateString("ar-EG", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      );
    });

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

  const weekly = useMemo(
    () =>
      (analytics?.weekly ?? []).slice(-6).map((row) => ({
        label: formatShortDate(row.bucket),
        value: row.rate ?? 0,
        hint: `${formatShortDate(row.bucket)} — ${percent(row.rate)}`,
      })),
    [analytics],
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

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> مساحتك الرعوية
            </>
          }
          title={`${greeting} يا ${user?.name?.replace(/^أ\.\s*/, "") || "خادم المسيح"}`}
          subtitle={`${todayArabic} — نظرة سريعة على رحلة أولادنا هذا الشهر.`}
          actions={
            <>
              <Link href="/attendance" className="btn sm">
                <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                تسجيل حضور اليوم
              </Link>
              <Link href="/follow-ups" className="btn ghost sm">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                المتابعات
              </Link>
            </>
          }
        />

        <Reveal><section className="hero-inner-card" aria-label="ملخص الخدمة">
          <span className="eyebrow" style={{ color: "rgba(255,255,255,.82)" }}>
            رحلة الطالب
          </span>
          <h2>كل طفل له حكاية… ونحن هنا لنرافقها</h2>
          <p>
            حضور، افتقاد، متابعة رعوية وتقدم تعليمي في مكان واحد — بلغة واضحة وأرقام حقيقية.
          </p>
          <div className="hero-chips">
            <span>
              <Baby className="h-3.5 w-3.5" aria-hidden="true" />
              {numberAr(students)} طفل
            </span>
            <span>
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {numberAr(analytics?.totals.activeClasses ?? classes.length)} فصل
            </span>
            <span>
              <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
              {numberAr(summary.open + summary.inProgress)} متابعة نشطة
            </span>
            {summary.overdue > 0 ? (
              <span>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {numberAr(summary.overdue)} متأخرة
              </span>
            ) : null}
          </div>
        </section></Reveal>

        {loading ? (
          <SkeletonCards count={4} />
        ) : (
          <Reveal><section className="kpi-grid" aria-label="المؤشرات الرئيسية">
            <Reveal className="kpi-grid-item">
            <StatCard
              label="الأطفال المسجلون"
              value={numberAr(students)}
              hint={`${numberAr(analytics?.totals.childrenWithAttendance ?? 0)} طفل لديه سجل حضور`}
              icon={<Baby className="h-4 w-4" />}
              color="var(--pri)"
            />
            </Reveal>
            <Reveal className="kpi-grid-item" delay={MOTION.stagger}>
            <StatCard
              label="نسبة الحضور (30 يومًا)"
              value={percent(attendanceRate)}
              hint={`${numberAr(analytics?.totals.recordedRecords ?? 0)} سجل حضور`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              color="var(--ok)"
            />
            </Reveal>
            <Reveal className="kpi-grid-item" delay={MOTION.stagger * 2}>
            <StatCard
              label="متابعات نشطة"
              value={numberAr(summary.open + summary.inProgress)}
              hint={`${numberAr(summary.open)} مفتوحة · ${numberAr(summary.inProgress)} قيد المتابعة`}
              icon={<HeartHandshake className="h-4 w-4" />}
              color="var(--warn)"
            />
            </Reveal>
            <Reveal className="kpi-grid-item" delay={MOTION.stagger * 3}>
            <StatCard
              label="متابعات متأخرة"
              value={numberAr(summary.overdue)}
              hint={summary.overdue > 0 ? "تحتاج تدخّلًا اليوم" : "لا يوجد تأخير — شكرًا لاجتهادكم"}
              icon={<AlertTriangle className="h-4 w-4" />}
              color="var(--danger)"
            />
            </Reveal>
          </section></Reveal>
        )}

        <div className="two-col">
          <div className="stack">
            <section className="surface surface-pad" aria-label="اتجاه الحضور">
              <div className="surface-head">
                <div>
                  <h2>اتجاه الحضور الأسبوعي</h2>
                  <p>نسبة الحضور والغياب بعذر خلال آخر 6 أسابيع</p>
                </div>
                <Link href="/analytics" className="link-quiet">
                  التحليلات <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {loading ? (
                <div className="skel" style={{ height: 150 }} />
              ) : weekly.length > 0 && analytics?.totals.recordedRecords ? (
                <>
                  <MiniBars data={weekly} height={150} />
                  <div className="legend">
                    <span>
                      <i style={{ ["--l-color" as string]: "var(--pri)" }} /> نسبة الحضور الأسبوعية
                    </span>
                    <span>
                      <i style={{ ["--l-color" as string]: "var(--warn)" }} /> الغياب بعذر لا يُحتسب حضورًا
                    </span>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon="📊"
                  title="لا توجد بيانات حضور بعد"
                  description="سجّل حضور أول جلسة وسيبدأ المخطط في الظهور فورًا."
                  action={
                    <Link href="/attendance" className="btn sm">
                      تسجيل الحضور
                    </Link>
                  }
                />
              )}
            </section>

            <section className="surface surface-pad" aria-label="متابعات تحتاج اهتمامًا">
              <div className="surface-head">
                <div>
                  <h2>محتاجين متابعة</h2>
                  <p>حالات مفتوحة مرتبة حسب الأولوية والاستحقاق</p>
                </div>
                <Link href="/follow-ups" className="link-quiet">
                  عرض الكل <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
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
                  title="لا توجد متابعات نشطة"
                  description="كل الأطفال مستقرون في الحضور والافتقاد حاليًا. يمكنك تشغيل قواعد المتابعة يدويًا من صفحة المتابعات."
                  action={
                    <Link href="/follow-ups" className="btn ghost sm">
                      إدارة القواعد
                    </Link>
                  }
                />
              )}
            </section>
          </div>

          <div className="stack">
            <section className="surface surface-pad" aria-label="ملخص الرعاية">
              <div className="surface-head">
                <div>
                  <h2>ملخص الرعاية</h2>
                  <p>آخر 30 يومًا</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <ProgressRing
                  value={attendanceRate}
                  caption="نسبة الحضور"
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
                  <MetricRow label="حضور" value={analytics?.distribution.present ?? 0} tone="var(--ok)" />
                  <MetricRow label="غياب" value={analytics?.distribution.absent ?? 0} tone="var(--danger)" />
                  <MetricRow label="متأخر" value={analytics?.distribution.late ?? 0} tone="var(--warn)" />
                  <MetricRow label="بعذر" value={analytics?.distribution.excused ?? 0} tone="var(--violet)" />
                </div>
              </div>
              <div className="divider" style={{ margin: "16px 0" }} />
              <div className="stack-sm">
                <MetricRow
                  label="متابعات بدون مسؤول"
                  value={analytics?.followUps.unassignedCases ?? 0}
                  tone="var(--warn)"
                />
                <MetricRow
                  label="متابعات أُغلقت هذا الشهر"
                  value={analytics?.followUps.resolvedInRange ?? 0}
                  tone="var(--ok)"
                />
                <MetricRow
                  label="أنشطة رعوية مسجّلة"
                  value={analytics?.followUps.activitiesInRange ?? 0}
                  tone="var(--pri)"
                />
              </div>
            </section>

            <section className="surface surface-pad" aria-label="آخر الأخبار">
              <div className="surface-head">
                <div>
                  <h2>آخر الأخبار</h2>
                  <p>إعلانات الخدمة</p>
                </div>
                <Link href="/news" className="link-quiet">
                  الكل <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
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
                        <small>{new Date(item.createdAt).toLocaleDateString("ar-EG")}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon="📰" title="لا توجد أخبار منشورة" description="ستظهر إعلانات الخدمة هنا." />
              )}
            </section>

            <section className="surface surface-pad" aria-label="الفصول">
              <div className="surface-head">
                <div>
                  <h2>الفصول</h2>
                  <p>نسبة الحضور لكل فصل</p>
                </div>
                <Link href="/classes" className="link-quiet">
                  الكل <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
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
                        <small>{numberAr(item.students)} طفل · {numberAr(item.openFollowUps)} متابعة</small>
                      </span>
                      <Badge tone={item.rate === null ? "muted" : item.rate >= 85 ? "ok" : item.rate >= 70 ? "warn" : "danger"}>
                        {percent(item.rate)}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState icon="🏫" title="لا توجد فصول" description="أضف فصلًا من صفحة الفصول." />
              )}
            </section>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--mute)", fontSize: ".84rem" }}>
        <i style={{ width: 8, height: 8, borderRadius: 3, background: tone }} aria-hidden="true" />
        {label}
      </span>
      <b style={{ fontSize: ".98rem" }}>{numberAr(value)}</b>
    </div>
  );
}

function FollowUpRow({ item }: { item: FollowUpCase }) {
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
          {FOLLOW_UP_STATUS_LABELS[item.status]}
        </Badge>
        <Badge tone={priorityTone(item.priority)}>{PRIORITY_LABELS[item.priority]}</Badge>
      </span>
      {item.isOverdue ? (
        <Badge tone="danger">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> متأخرة
        </Badge>
      ) : null}
      <BarChart3 className="h-4 w-4 opacity-30" aria-hidden="true" />
    </Link>
  );
}
