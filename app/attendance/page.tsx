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
  attendanceTone,
  formatShortDateFor,
  initials,
  percent,
  shiftIso,
  todayIso,
} from "../lib/format";
import { useI18n } from "../lib/app-i18n";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_META: Array<{ value: Status; labelKey: string; color: string }> = [
  { value: "present", labelKey: "attendance.present", color: "var(--ok)" },
  { value: "absent", labelKey: "attendance.absent", color: "var(--danger)" },
  { value: "late", labelKey: "attendance.late", color: "var(--warn)" },
  { value: "excused", labelKey: "attendance.excused", color: "var(--violet)" },
];

export default function AttendancePage() {
  const { t, locale, number } = useI18n();
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
      setError(err instanceof Error ? err.message : t("attendance.loadError"));
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
        showToast(t("attendance.noClassToast"));
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
      showToast(err instanceof Error ? err.message : t("attendance.saveError"));
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
      showToast(t("attendance.markedAll"));
      loadData();
    } catch (err) {
      setAttendanceMap(snapshot);
      showToast(err instanceof Error ? err.message : t("attendance.saveError"));
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    if (children.length === 0) return;
    const rows = [
      [t("attendance.csvDate"), t("attendance.csvName"), t("attendance.csvClass"), t("attendance.csvStatus")],
      ...children.map((child) => [
        selectedDate,
        child.name,
        child.class?.name || t("common.noClass"),
        attendanceMap[child.id] ? t(`attendance.${attendanceMap[child.id]}`) : t("attendance.csvPending"),
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
    showToast(t("attendance.exported"));
  };

  const dateLabel = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedDate}T12:00:00`));

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <CalendarCheck className="h-4 w-4" aria-hidden="true" /> {t("attendance.eyebrow")}
            </>
          }
          title={t("attendance.title")}
          subtitle={dateLabel}
          actions={
            <>
              <Link href="/analytics" className="btn ghost sm">
                <BarChart3 className="h-4 w-4" aria-hidden="true" /> {t("attendance.analytics")}
              </Link>
              <button type="button" className="btn ghost sm" onClick={handleExport} disabled={children.length === 0}>
                <Download className="h-4 w-4" aria-hidden="true" /> {t("attendance.export")}
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={handleMarkAllPresent}
                disabled={syncing || children.length === 0}
              >
                <Check className="h-4 w-4" aria-hidden="true" /> {t("attendance.markAll")}
              </button>
            </>
          }
        />

        <div className="surface surface-pad">
          <div className="filters" style={{ justifyContent: "space-between" }}>
            <div className="grow-wrap">
              <button type="button" className="ib" onClick={() => changeDate(-1)} aria-label={t("attendance.prevDayAria")}>
                <ChevronRight className="h-4 w-4" />
              </button>
              <label className="fld" style={{ minWidth: 165 }}>
                <span className="sr-only">{t("attendance.dateAria")}</span>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(event) => {
                    if (event.target.value && event.target.value <= today) setSelectedDate(event.target.value);
                  }}
                  aria-label={t("attendance.dateAria")}
                />
              </label>
              <button
                type="button"
                className="ib"
                onClick={() => changeDate(1)}
                disabled={selectedDate >= today}
                aria-label={t("attendance.nextDayAria")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {selectedDate !== today ? (
                <button type="button" className="chip on" onClick={() => setSelectedDate(today)}>
                  {t("common.today")}
                </button>
              ) : null}
            </div>

            <label className="fld" style={{ minWidth: 180 }}>
              <span className="sr-only">{t("common.class")}</span>
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                aria-label={t("attendance.filterClassAria")}
              >
                <option value="all">{t("common.allClasses")}</option>
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
          <section className="surface surface-pad" aria-label={t("attendance.summaryAria")}>
            <div className="surface-head">
              <div>
                <h2>{t("attendance.summaryTitle")}</h2>
                <p>
                  {t("attendance.summaryHint", {
                    children: number(children.length),
                    attended: number(attended),
                    pending: number(counts.pending),
                  })}
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
                    {t(item.labelKey as Parameters<typeof t>[0])}
                  </span>
                  <b style={{ display: "block", fontSize: "1.35rem" }}>{number(counts[item.value])}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="surface surface-pad" aria-label={t("attendance.rateAria")}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <ProgressRing
                value={rate}
                caption={t("attendance.todayRate")}
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
                      {t(item.labelKey as Parameters<typeof t>[0])}
                    </span>
                    <b>{number(counts[item.value])}</b>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--mute)", fontSize: ".84rem" }}>{t("attendance.notRecorded")}</span>
                  <b>{number(counts.pending)}</b>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="surface surface-pad" aria-label={t("attendance.listAria")}>
          <div className="surface-head">
            <div>
              <h2>{t("attendance.recordTitle")}</h2>
              <p>{t("attendance.recordHint")}</p>
            </div>
            {syncing ? <Badge tone="warn">{t("attendance.saving")}</Badge> : null}
          </div>

          {error ? <div className="notice danger" style={{ marginBottom: 12 }}>{error}</div> : null}

          {loading ? (
            <SkeletonRows rows={6} height={64} />
          ) : children.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="h-5 w-5" />}
              title={t("attendance.noChildren")}
              description={t("attendance.noChildrenHint")}
              action={
                <Link href="/children" className="btn sm">
                  {t("attendance.manageChildren")}
                </Link>
              }
            />
          ) : (
            <div className="list-stack">
              {children.map((child) => {
                const status = attendanceMap[child.id];
                return (
                  <div key={child.id} className="listrow listrow-person">
                    <div className="listrow-main">
                      <span className="avatar-md" aria-hidden="true">
                        {initials(child.name)}
                      </span>
                      <span className="grow">
                        <b>{child.name}</b>
                        <small>
                          {child.class?.name || t("common.noClass")}
                          {child.assignedServant?.name ? ` · ${child.assignedServant.name}` : ""}
                        </small>
                      </span>

                      {status ? (
                        <Badge tone={attendanceTone(status)} dot>
                          {t(`attendance.${status}`)}
                        </Badge>
                      ) : (
                        <Badge tone="muted">
                          <Clock className="h-3 w-3" aria-hidden="true" /> {t("attendance.notRecorded")}
                        </Badge>
                      )}
                    </div>

                    <div className="listrow-actions" role="group" aria-label={t("attendance.childAria", { name: child.name })}>
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
                          {t(item.labelKey as Parameters<typeof t>[0])}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="surface surface-pad" aria-label={t("attendance.sessionsAria")}>
          <div className="surface-head">
            <div>
              <h2>{t("attendance.sessionsTitle")}</h2>
              <p>{t("attendance.sessionsHint")}</p>
            </div>
            <Link href="/analytics" className="link-quiet">
              {t("attendance.fullReport")} <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title={t("attendance.noSessions")}
              description={t("attendance.noSessionsHint")}
            />
          ) : (
            <div className="list-stack">
              {sessions.map((session) => (
                <div key={session.id} className="listrow listrow-person">
                  <div className="listrow-main">
                    <span className="avatar-md" aria-hidden="true">
                      <CalendarCheck className="h-4 w-4" />
                    </span>
                    <span className="grow">
                      <b>{session.className || t("attendance.sessionClassFallback")}</b>
                      <small>
                        {t("attendance.sessionSummary", {
                          count: number(session.total),
                          present: number(session.present),
                        })}
                        {" · "}
                        {formatShortDateFor(session.date, locale)}
                      </small>
                    </span>
                  </div>
                  <div className="listrow-actions">
                    <Badge tone="ok">{number(session.present)}</Badge>
                    <Badge tone="danger">{number(session.absent)}</Badge>
                    <Badge tone="warn">{number(session.late)}</Badge>
                    <Badge tone="violet">{number(session.excused)}</Badge>
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
