"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  Badge,
  EmptyState,
  PageHeader,
  ProgressRing,
  SkeletonRows,
} from "../components/ui";
import {
  getAttendance,
  getAttendanceSessions,
  getChildren,
  getClasses,
  recordAttendanceBulk,
  type AttendanceRecord,
  type AttendanceSession,
  type ChildItem,
  type ClassItem,
} from "../lib/api";
import {
  ATTENDANCE_LABELS,
  attendanceTone,
  formatShortDate,
  numberAr,
  percent,
  shiftIso,
  todayIso,
} from "../lib/format";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_META: Array<{ value: Status; label: string; color: string }> = [
  { value: "present", label: "حاضر", color: "var(--ok)" },
  { value: "absent", label: "غائب", color: "var(--danger)" },
  { value: "late", label: "متأخر", color: "var(--warn)" },
  { value: "excused", label: "بعذر", color: "var(--violet)" },
];

export default function AttendancePage() {
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Status>>({});
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [resClasses, resChildren, resAttendance, resSessions] = await Promise.all([
        getClasses(),
        getChildren({
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
          limit: 100,
        }),
        getAttendance(selectedClassId !== "all" ? selectedClassId : undefined, selectedDate),
        getAttendanceSessions({
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
          limit: 6,
        }),
      ]);

      setClasses(resClasses);
      setChildren(resChildren.data);
      const map: Record<string, Status> = {};
      resAttendance.forEach((record: AttendanceRecord) => {
        map[record.childId] = record.status;
      });
      setAttendanceMap(map);
      setSessions(resSessions.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الحضور");
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeDate = (days: number) => {
    const next = shiftIso(selectedDate, days);
    if (next <= today) setSelectedDate(next);
  };

  const counts = useMemo(() => {
    const result = { present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
    children.forEach((child) => {
      const status = attendanceMap[child.id];
      if (status) result[status] += 1;
      else result.pending += 1;
    });
    return result;
  }, [children, attendanceMap]);

  const attended = counts.present + counts.late;
  const rate = children.length > 0 ? Math.round((attended / children.length) * 1000) / 10 : null;

  const handleMark = async (child: ChildItem, status: Status) => {
    const previous = attendanceMap[child.id];
    if (previous === status) return;

    setAttendanceMap((current) => ({ ...current, [child.id]: status }));
    try {
      setSyncing(true);
      const classId = child.classId || (selectedClassId !== "all" ? selectedClassId : classes[0]?.id);
      if (!classId) {
        showToast("الطفل غير مرتبط بفصل — عيّن فصلًا أولًا");
        return;
      }
      await recordAttendanceBulk({
        classId,
        date: selectedDate,
        records: [{ childId: child.id, status }],
      });
    } catch (err) {
      setAttendanceMap((current) => {
        const copy = { ...current };
        if (previous) copy[child.id] = previous;
        else delete copy[child.id];
        return copy;
      });
      showToast(err instanceof Error ? err.message : "تعذر حفظ الحضور");
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkAllPresent = async () => {
    if (children.length === 0) return;
    const snapshot = { ...attendanceMap };
    const next = { ...attendanceMap };
    children.forEach((child) => {
      next[child.id] = "present";
    });
    setAttendanceMap(next);

    try {
      setSyncing(true);
      const grouped = new Map<string, string[]>();
      children.forEach((child) => {
        const classId = child.classId || (selectedClassId !== "all" ? selectedClassId : classes[0]?.id);
        if (!classId) return;
        const list = grouped.get(classId) ?? [];
        list.push(child.id);
        grouped.set(classId, list);
      });

      for (const [classId, childIds] of grouped) {
        await recordAttendanceBulk({
          classId,
          date: selectedDate,
          records: childIds.map((childId) => ({ childId, status: "present" as const })),
        });
      }
      showToast("تم تسجيل الكل حاضر");
      loadData();
    } catch (err) {
      setAttendanceMap(snapshot);
      showToast(err instanceof Error ? err.message : "تعذر حفظ الحضور");
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    if (children.length === 0) return;
    const rows = [
      ["التاريخ", "اسم الطفل", "الفصل", "الحالة"],
      ...children.map((child) => [
        selectedDate,
        child.name,
        child.class?.name || "بدون فصل",
        attendanceMap[child.id] ? ATTENDANCE_LABELS[attendanceMap[child.id]] : "لم يسجل بعد",
      ]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("تم تصدير ملف الحضور");
  };

  const dateLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <CalendarCheck className="h-4 w-4" aria-hidden="true" /> جلسة اليوم
            </>
          }
          title="سجل الحضور"
          subtitle={dateLabel}
          actions={
            <>
              <Link href="/analytics" className="btn ghost sm">
                <BarChart3 className="h-4 w-4" aria-hidden="true" /> التحليلات
              </Link>
              <button type="button" className="btn ghost sm" onClick={handleExport} disabled={children.length === 0}>
                <Download className="h-4 w-4" aria-hidden="true" /> CSV
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={handleMarkAllPresent}
                disabled={syncing || children.length === 0}
              >
                <Check className="h-4 w-4" aria-hidden="true" /> الكل حاضر
              </button>
            </>
          }
        />

        <div className="surface surface-pad">
          <div className="filters" style={{ justifyContent: "space-between" }}>
            <div className="grow-wrap">
              <button type="button" className="ib" onClick={() => changeDate(-1)} aria-label="اليوم السابق">
                <ChevronRight className="h-4 w-4" />
              </button>
              <label className="fld" style={{ minWidth: 165 }}>
                <span className="sr-only">تاريخ الحضور</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(event) => {
                    if (event.target.value && event.target.value <= today) setSelectedDate(event.target.value);
                  }}
                  aria-label="تاريخ الحضور"
                />
              </label>
              <button
                type="button"
                className="ib"
                onClick={() => changeDate(1)}
                disabled={selectedDate >= today}
                aria-label="اليوم التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {selectedDate !== today ? (
                <button type="button" className="chip on" onClick={() => setSelectedDate(today)}>
                  اليوم
                </button>
              ) : null}
            </div>

            <label className="fld" style={{ minWidth: 180 }}>
              <span className="sr-only">الفصل</span>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
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
        </div>

        <div className="two-col">
          <section className="surface surface-pad" aria-label="ملخص الجلسة">
            <div className="surface-head">
              <div>
                <h2>ملخص الجلسة</h2>
                <p>
                  {numberAr(children.length)} طفل · {numberAr(attended)} حضور · {numberAr(counts.pending)} بانتظار التسجيل
                </p>
              </div>
              <Badge tone={rate === null ? "muted" : rate >= 85 ? "ok" : rate >= 70 ? "warn" : "danger"}>
                {percent(rate)}
              </Badge>
            </div>

            <div className="kpi-grid">
              {STATUS_META.map((item) => (
                <div key={item.value} className="surface" style={{ padding: "12px 14px", boxShadow: "none" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--mute)",
                      fontSize: ".78rem",
                      fontWeight: 700,
                    }}
                  >
                    <i style={{ width: 8, height: 8, borderRadius: 3, background: item.color }} aria-hidden="true" />
                    {item.label}
                  </span>
                  <b style={{ display: "block", fontSize: "1.35rem" }}>{numberAr(counts[item.value])}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="surface surface-pad" aria-label="نسبة الحضور">
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <ProgressRing
                value={rate}
                caption="حضور اليوم"
                color={
                  rate === null
                    ? "var(--mute)"
                    : rate >= 85
                      ? "var(--ok)"
                      : rate >= 70
                        ? "var(--warn)"
                        : "var(--danger)"
                }
              />
              <div className="stack-sm" style={{ flex: 1, minWidth: 150 }}>
                {STATUS_META.map((item) => (
                  <div key={item.value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--mute)", fontSize: ".84rem" }}>
                      <i style={{ width: 8, height: 8, borderRadius: 3, background: item.color }} aria-hidden="true" />
                      {item.label}
                    </span>
                    <b>{numberAr(counts[item.value])}</b>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--mute)", fontSize: ".84rem" }}>لم يُسجّل</span>
                  <b>{numberAr(counts.pending)}</b>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="surface surface-pad" aria-label="قائمة الأطفال">
          <div className="surface-head">
            <div>
              <h2>تسجيل الحضور</h2>
              <p>اختر حالة لكل طفل — تُحفظ فورًا في الخادم.</p>
            </div>
            {syncing ? <Badge tone="warn">جارٍ الحفظ…</Badge> : null}
          </div>

          {error ? <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div> : null}

          {loading ? (
            <SkeletonRows rows={6} height={64} />
          ) : children.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="h-5 w-5" />}
              title="لا يوجد أطفال في هذا الفصل"
              description="أضف أطفالًا أو اختر فصلًا آخر لتسجيل الحضور."
              action={
                <Link href="/children" className="btn sm">
                  إدارة الأطفال
                </Link>
              }
            />
          ) : (
            <div className="list-stack">
              {children.map((child) => {
                const status = attendanceMap[child.id];
                return (
                  <div key={child.id} className="listrow">
                    <span className="avatar-md" aria-hidden="true">
                      {child.name.charAt(0)}
                    </span>
                    <span className="grow">
                      <b>{child.name}</b>
                      <small>
                        {child.class?.name || "بدون فصل"}
                        {child.assignedServant?.name ? ` · ${child.assignedServant.name}` : ""}
                      </small>
                    </span>

                    {status ? (
                      <Badge tone={attendanceTone(status)} dot>
                        {ATTENDANCE_LABELS[status]}
                      </Badge>
                    ) : (
                      <Badge tone="muted">
                        <Clock className="h-3 w-3" aria-hidden="true" /> لم يُسجّل
                      </Badge>
                    )}

                    <div className="grow-wrap" role="group" aria-label={`حضور ${child.name}`}>
                      {STATUS_META.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          className={`status-btn ${status === item.value ? "on" : ""}`}
                          style={{ ["--s-color" as string]: item.color }}
                          onClick={() => handleMark(child, item.value)}
                          disabled={syncing}
                          aria-pressed={status === item.value}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="surface surface-pad" aria-label="آخر الجلسات">
          <div className="surface-head">
            <div>
              <h2>آخر الجلسات</h2>
              <p>سجل الجلسات المحفوظة ونسب الحضور</p>
            </div>
            <Link href="/analytics" className="link-quiet">
              تقرير كامل <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title="لا توجد جلسات محفوظة"
              description="ستظهر الجلسة هنا بعد حفظ أول حضور."
            />
          ) : (
            <div className="list-stack">
              {sessions.map((session) => (
                <div key={session.id} className="listrow">
                  <span className="avatar-md" aria-hidden="true">
                    <CalendarCheck className="h-4 w-4" />
                  </span>
                  <span className="grow">
                    <b>{session.className || "فصل"}</b>
                    <small>
                      {formatShortDate(session.date)} · {numberAr(session.total)} طفل · {numberAr(session.present)} حاضر
                    </small>
                  </span>
                  <div className="grow-wrap" style={{ justifyContent: "flex-end" }}>
                    <Badge tone="ok">{numberAr(session.present)}</Badge>
                    <Badge tone="danger">{numberAr(session.absent)}</Badge>
                    <Badge tone="warn">{numberAr(session.late)}</Badge>
                    <Badge tone="violet">{numberAr(session.excused)}</Badge>
                    <Badge tone={session.rate == null ? "muted" : session.rate >= 85 ? "ok" : "warn"}>
                      {percent(session.rate ?? null)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}
