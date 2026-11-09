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
import {
  ATTENDANCE_LABELS,
  formatShortDate,
  numberAr,
  percent,
  shiftIso,
  todayIso,
} from "../lib/format";

const RANGES: Array<{ key: number; label: string }> = [
  { key: 30, label: "30 يومًا" },
  { key: 90, label: "90 يومًا" },
  { key: 180, label: "6 أشهر" },
  { key: 365, label: "سنة" },
];

function monthLabel(bucket: string): string {
  const date = new Date(`${bucket.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return bucket;
  return date.toLocaleDateString("ar-EG", { month: "short", year: "2-digit" });
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [classId, setClassId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialise date range on first client render (safe from prerender)
  useEffect(() => {
    if (from === null) {
      const today = todayIso();
      setFrom(shiftIso(today, -89));
      setTo(today);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!from || !to) return;
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
      setError(err instanceof Error ? err.message : "تعذر تحميل التحليلات");
    } finally {
      setLoading(false);
    }
  }, [from, to, classId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyRange = (days: number) => {
    setFrom(shiftIso(todayIso(), -(days - 1)));
    setTo(todayIso());
  };

  const activeRangeDays = useMemo(() => {
    if (!from || !to) return null;
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
      (overview?.weekly ?? []).slice(-14).map((item) => ({
        label: formatShortDate(item.bucket),
        value: item.total,
        hint: `${formatShortDate(item.bucket)} — ${numberAr(item.total)} سجل`,
      })),
    [overview],
  );

  const monthlyBars = useMemo(
    () =>
      (overview?.monthly ?? []).map((item) => ({
        label: monthLabel(item.bucket),
        value: item.total,
        hint: `${monthLabel(item.bucket)} — ${numberAr(item.total)} سجل`,
      })),
    [overview],
  );

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <BarChart3 className="h-4 w-4" aria-hidden="true" /> قراءة الأرقام
            </>
          }
          title="التحليلات الرعوية"
          subtitle="حضور، غياب، ومتابعات — أرقام من قاعدة البيانات فقط، ضمن نطاق فصولك وصلاحياتك."
          actions={
            <button type="button" className="btn ghost sm" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> تحديث
            </button>
          }
        />

        <section className="surface surface-pad" aria-label="فلاتر التحليلات">
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
                  {range.label}
                </button>
              ))}
            </div>

            <label className="fld" style={{ minWidth: 150 }}>
              <span className="sr-only">من تاريخ</span>
              <input
                type="date"
                value={from ?? ""}
                max={to ?? undefined}
                onChange={(event) => setFrom(event.target.value)}
                aria-label="من تاريخ"
              />
            </label>

            <label className="fld" style={{ minWidth: 150 }}>
              <span className="sr-only">إلى تاريخ</span>
              <input
                type="date"
                value={to ?? ""}
                min={from ?? undefined}
                onChange={(event) => setTo(event.target.value)}
                aria-label="إلى تاريخ"
              />
            </label>

            <label className="fld" style={{ minWidth: 170 }}>
              <span className="sr-only">الفصل</span>
              <select
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
                aria-label="تصفية بالفصل"
              >
                <option value="all">كل الفصول</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

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
                  لا توجد سجلات حضور في الفترة المحددة ({formatShortDate(from)} — {formatShortDate(to)}
                  ). الأرقام أدناه تعكس الواقع ولا يتم توليد بيانات تجريبية. ابدأ من صفحة الحضور لتسجيل أول جلسة.
                </span>
              </Notice>
            ) : null}

            <section className="kpi-grid" aria-label="المؤشرات الرئيسية">
              <StatCard
                label="نسبة الحضور"
                value={percent(totals.attendanceRate)}
                hint={`${numberAr(distribution.present + distribution.late)} حضور من ${numberAr(distribution.total)} سجل`}
                icon={<TrendingUp className="h-4 w-4" />}
                color="var(--ok)"
              />
              <StatCard
                label="سجلات الحضور"
                value={numberAr(totals.recordedRecords)}
                hint={`${numberAr(totals.attendanceSessions)} جلسة · ${numberAr(totals.childrenWithAttendance)} طفل`}
                icon={<CalendarCheck className="h-4 w-4" />}
                color="var(--pri)"
              />
              <StatCard
                label="الأطفال والفصول"
                value={`${numberAr(totals.students)} / ${numberAr(totals.activeClasses)}`}
                hint="طفل مسجّل / فصل نشط"
                icon={<Baby className="h-4 w-4" />}
                color="var(--violet)"
              />
              <StatCard
                label="متابعات مفتوحة"
                value={numberAr(followUps.workload)}
                hint={`${numberAr(followUps.overdueCases)} متأخرة · ${numberAr(followUps.childrenWithOpenCases)} طفل`}
                icon={<HeartHandshake className="h-4 w-4" />}
                color="var(--danger)"
              />
            </section>

            <div className="two-col">
              <section className="surface surface-pad" aria-label="توزيع الحضور">
                <div className="surface-head">
                  <div>
                    <h2>توزيع الحضور</h2>
                    <p>كل سجل مصنّف حسب الحالة المعتمدة.</p>
                  </div>
                  <ProgressRing
                    value={totals.attendanceRate}
                    caption="نسبة الحضور"
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
                    title="لا توجد سجلات في هذه الفترة"
                    description="غيّر الفترة أو سجّل حضورًا جديدًا."
                    action={
                      <Link href="/attendance" className="btn ghost sm">
                        تسجيل الحضور
                      </Link>
                    }
                  />
                ) : (
                  <div className="stack-sm">
                    {(
                      [
                        ["present", distribution.present, "var(--ok)"],
                        ["late", distribution.late, "var(--warn)"],
                        ["excused", distribution.excused, "var(--violet)"],
                        ["absent", distribution.absent, "var(--danger)"],
                      ] as Array<[string, number, string]>
                    ).map(([status, value, color]) => {
                      const share = distribution.total > 0 ? Math.round((value / distribution.total) * 100) : 0;
                      return (
                        <div key={status}>
                          <div className="grow-wrap" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: ".88rem", fontWeight: 700 }}>{ATTENDANCE_LABELS[status]}</span>
                            <span style={{ fontSize: ".82rem", color: "var(--mute)" }}>
                              {numberAr(value)} · {percent(share)}
                            </span>
                          </div>
                          <div
                            role="img"
                            aria-label={`${ATTENDANCE_LABELS[status]}: ${value} من ${distribution.total}`}
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
              </section>

              <section className="surface surface-pad" aria-label="حالة المتابعة الرعوية">
                <div className="surface-head">
                  <div>
                    <h2>الرعاية والمتابعة</h2>
                    <p>حالة الحالات ضمن الفترة المحددة.</p>
                  </div>
                </div>
                <div className="stack-sm">
                  <FollowRow label="مفتوحة" value={followUps.openCases} tone="danger" />
                  <FollowRow label="قيد المتابعة" value={followUps.inProgressCases} tone="warn" />
                  <FollowRow label="متأخرة" value={followUps.overdueCases} tone="violet" />
                  <FollowRow label="أُغلقت في الفترة" value={followUps.resolvedInRange} tone="ok" />
                  <FollowRow label="بدون خادم مسؤول" value={followUps.unassignedCases} tone="muted" />
                  <FollowRow label="أنشطة موثّقة" value={followUps.activitiesInRange} tone="pri" />
                </div>
                <Link href="/follow-ups" className="btn ghost sm" style={{ marginTop: 14, justifyContent: "center" }}>
                  <HeartHandshake className="h-4 w-4" aria-hidden="true" /> فتح المتابعات
                </Link>
              </section>
            </div>

            <div className="two-col">
              <section className="surface surface-pad" aria-label="اتجاه الحضور الأسبوعي">
                <div className="surface-head">
                  <div>
                    <h2>الاتجاه الأسبوعي</h2>
                    <p>عدد السجلات في كل أسبوع.</p>
                  </div>
                  <Badge tone="muted">آخر {numberAr(weeklyBars.length)} أسبوع</Badge>
                </div>
                {weeklyBars.length === 0 || distribution.total === 0 ? (
                  <EmptyState title="لا يوجد اتجاه بعد" description="سيظهر المخطط بعد تسجيل جلسات حضور." />
                ) : (
                  <MiniBars data={weeklyBars} height={150} />
                )}
              </section>

              <section className="surface surface-pad" aria-label="الاتجاه الشهري">
                <div className="surface-head">
                  <div>
                    <h2>الاتجاه الشهري</h2>
                    <p>مقارنة السجلات شهرًا بشهر.</p>
                  </div>
                </div>
                {monthlyBars.length === 0 || distribution.total === 0 ? (
                  <EmptyState title="لا يوجد اتجاه بعد" description="سيظهر المخطط بعد تسجيل جلسات حضور." />
                ) : (
                  <MiniBars data={monthlyBars} height={150} />
                )}
              </section>
            </div>

            <section className="surface surface-pad" aria-label="مقارنة الفصول">
              <div className="surface-head">
                <div>
                  <h2>أداء الفصول</h2>
                  <p>مرتّبة حسب نسبة الحضور — الفصول بلا سجلات تظهر بدون نسبة.</p>
                </div>
                <Badge tone="muted">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" /> {numberAr(overview.classes.length)} فصل
                </Badge>
              </div>

              {overview.classes.length === 0 ? (
                <EmptyState title="لا توجد فصول" description="أضف فصلًا وأطفالًا لتبدأ القراءة." />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <caption className="sr-only">أداء الفصول حسب الحضور والمتابعات</caption>
                    <thead>
                      <tr>
                        <th scope="col">الفصل</th>
                        <th scope="col">الأطفال</th>
                        <th scope="col">السجلات</th>
                        <th scope="col">نسبة الحضور</th>
                        <th scope="col">غياب</th>
                        <th scope="col">متابعات مفتوحة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.classes.map((item) => (
                        <tr key={item.id}>
                          <th scope="row" style={{ fontWeight: 800 }}>
                            {item.name}
                          </th>
                          <td>{numberAr(item.students)}</td>
                          <td>{numberAr(item.total)}</td>
                          <td>
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
                          <td>{numberAr(item.absent)}</td>
                          <td>
                            {item.openFollowUps > 0 ? (
                              <Badge tone="danger">{numberAr(item.openFollowUps)}</Badge>
                            ) : (
                              <Badge tone="ok">لا يوجد</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}

function FollowRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
      <span style={{ fontSize: ".88rem" }}>{label}</span>
      <Badge tone={tone}>{numberAr(value)}</Badge>
    </div>
  );
}
