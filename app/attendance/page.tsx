"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  WifiOff,
  RefreshCw,
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
  getStoredUser,
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
import { useOnlineStatus } from "../lib/use-online-status";
import {
  enqueueAttendance,
  supersedePendingForChild,
  cacheClasses,
  cacheChildren,
  cacheAttendance,
  getCachedClasses,
  getCachedChildren,
  getCachedAttendance,
  getUnsyncedOps,
  dismissFailedOps,
  type AttendanceStatus,
  type SyncState,
} from "../lib/offline-db";
import {
  syncNow,
  subscribeSyncStatus,
  recheckPending,
  attachNetworkListener,
  type SyncStatus,
} from "../lib/sync-engine";

type Status = AttendanceStatus;

interface QueueBadgeInfo {
  state: SyncState;
  error?: string;
}

const STATUS_META: Array<{ value: Status; labelKey: string; color: string }> = [
  { value: "present", labelKey: "attendance.present", color: "var(--ok)" },
  { value: "absent", labelKey: "attendance.absent", color: "var(--danger)" },
  { value: "late", labelKey: "attendance.late", color: "var(--warn)" },
  { value: "excused", labelKey: "attendance.excused", color: "var(--violet)" },
];

function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
}

export default function AttendancePage() {
  const { t, locale, number } = useI18n();
  const isOnline = useOnlineStatus();
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Status>>({});
  const [pendingMap, setPendingMap] = useState<Record<string, QueueBadgeInfo>>({});
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingLocally, setSavingLocally] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [failedQueueCount, setFailedQueueCount] = useState(0);
  const [failedErrorMsg, setFailedErrorMsg] = useState<string | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSyncStatusRef = useRef<SyncStatus>("idle");

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const currentUserId = useCallback(() => getStoredUser()?.id ?? "", []);

  // ── Connectivity listener ─────────────────────────────────────────────────
  useEffect(() => {
    attachNetworkListener();
    void recheckPending();
  }, []);

  // ── Overlay unsynced queue entries for selectedDate ──────────────────────
  const refreshPendingMap = useCallback(async () => {
    const userId = currentUserId();
    if (!userId) {
      setPendingMap({});
      setOfflineQueueCount(0);
      setFailedQueueCount(0);
      setFailedErrorMsg(null);
      return;
    }

    const ops = await getUnsyncedOps(userId).catch(() => []);
    const map: Record<string, QueueBadgeInfo> = {};
    for (const op of ops) {
      if (op.date === selectedDate) {
        map[op.childId] = { state: op.syncState, error: op.lastError };
      }
    }
    const failedOps = ops.filter((o) => o.syncState === "failed");
    setPendingMap(map);
    setOfflineQueueCount(ops.length);
    setFailedQueueCount(failedOps.length);
    setFailedErrorMsg(failedOps[0]?.lastError ?? null);
  }, [currentUserId, selectedDate]);

  // ── Load from IndexedDB (offline mode or network fallback) ───────────────
  const loadFromOfflineCache = useCallback(async () => {
    const userId = currentUserId();
    if (!userId) {
      setClasses([]);
      setChildren([]);
      setAttendanceMap({});
      setSessions([]);
      return;
    }

    const classFilter = selectedClassId !== "all" ? selectedClassId : undefined;
    const [cachedClasses, cachedChildrenData, cachedAttendanceData, unsyncedOps] =
      await Promise.all([
        getCachedClasses(userId),
        getCachedChildren(userId, classFilter),
        getCachedAttendance(userId, selectedDate, classFilter),
        getUnsyncedOps(userId),
      ]);

    setClasses(
      cachedClasses.map((cls) => ({
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        academicYear: cls.academicYear,
        childrenCount: cls.childrenCount,
      })),
    );

    setChildren(
      cachedChildrenData.map((child) => ({
        id: child.id,
        name: child.name,
        classId: child.classId,
        class: child.className ? { id: child.classId ?? "", name: child.className } : null,
        assignedServant: child.assignedServantName
          ? { id: "", name: child.assignedServantName }
          : null,
      })),
    );

    const map: Record<string, Status> = {};
    for (const entry of cachedAttendanceData) {
      map[entry.childId] = entry.status;
    }

    // Overlay unsynced offline mutations chronologically so offline marks
    // survive page reloads and browser restarts.
    for (const op of unsyncedOps) {
      if (op.date !== selectedDate) continue;
      if (classFilter && op.classId !== classFilter) continue;
      map[op.childId] = op.status;
    }

    setAttendanceMap(map);
    setSessions([]);
    setError(null);
  }, [currentUserId, selectedClassId, selectedDate]);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const userId = currentUserId();

    if (isOnline) {
      try {
        const classFilter = selectedClassId !== "all" ? selectedClassId : undefined;
        const [resClasses, resChildren, resAttendance, resSessions] = await Promise.all([
          getClasses(),
          getChildren({ classId: classFilter, limit: 100 }),
          getAttendance(classFilter, selectedDate),
          getAttendanceSessions({ classId: classFilter, limit: 6 }),
        ]);

        setClasses(resClasses);
        setChildren(resChildren.data);

        const map: Record<string, Status> = {};
        (resAttendance as AttendanceRecord[]).forEach((record) => {
          map[record.childId] = record.status;
        });

        // Preserve any pending local offline marks not yet synced so an
        // immediate online reload never hides un-synced work.
        const unsyncedOps = userId ? await getUnsyncedOps(userId).catch(() => []) : [];
        for (const op of unsyncedOps) {
          if (op.date !== selectedDate) continue;
          if (classFilter && op.classId !== classFilter) continue;
          map[op.childId] = op.status;
        }

        setAttendanceMap(map);
        setSessions(resSessions.data);
        setError(null);

        if (userId) {
          await Promise.all([
            cacheClasses(
              userId,
              resClasses.map((cls) => ({
                id: cls.id,
                name: cls.name,
                grade: cls.grade,
                academicYear: cls.academicYear,
                childrenCount: cls.childrenCount,
              })),
            ),
            cacheChildren(
              userId,
              resChildren.data.map((child) => ({
                id: child.id,
                name: child.name,
                classId: child.classId ?? null,
                className: child.class?.name,
                assignedServantName: child.assignedServant?.name ?? undefined,
              })),
              classFilter,
            ),
            cacheAttendance(
              userId,
              (resAttendance as AttendanceRecord[]).map((rec) => ({
                classId: rec.classId,
                date: rec.date,
                childId: rec.childId,
                status: rec.status,
              })),
              { date: selectedDate, classId: classFilter },
            ),
          ]);
        }
      } catch (err) {
        if (isNetworkFailure(err)) {
          await loadFromOfflineCache().catch(() => {
            setError(t("attendance.loadError"));
          });
        } else {
          setError(err instanceof Error ? err.message : t("attendance.loadError"));
        }
      } finally {
        setLoading(false);
      }
    } else {
      try {
        await loadFromOfflineCache();
      } catch {
        setError(t("attendance.loadError"));
      } finally {
        setLoading(false);
      }
    }

    await refreshPendingMap();
  }, [
    currentUserId,
    isOnline,
    selectedClassId,
    selectedDate,
    t,
    loadFromOfflineCache,
    refreshPendingMap,
  ]);

  useEffect(() => {
    // loadData synchronizes attendance state from server / IndexedDB on mount and filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // ── Subscribe to sync engine status ───────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeSyncStatus((status, pending, failedCount, lastError) => {
      setOfflineQueueCount(pending);
      setFailedQueueCount(failedCount);
      setFailedErrorMsg(lastError);

      const prev = prevSyncStatusRef.current;
      prevSyncStatusRef.current = status;

      if (prev === "syncing" && status === "synced") {
        void refreshPendingMap();
        void loadData();
      } else if (status === "failed" || (prev === "syncing" && status !== "syncing")) {
        void refreshPendingMap();
      }
    });
    return unsub;
  }, [loadData, refreshPendingMap]);

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

  // ── Helper: enqueue a single mark offline ────────────────────────────────
  const queueOfflineMark = useCallback(
    async (userId: string, classId: string, childId: string, status: Status) => {
      setSavingLocally(true);
      try {
        await enqueueAttendance({
          operationId: uuidv4(),
          userId,
          classId,
          date: selectedDate,
          childId,
          status,
        });
        await recheckPending();
        await refreshPendingMap();
        showToast(t("offline.savedOffline"));
      } finally {
        setSavingLocally(false);
      }
    },
    [selectedDate, refreshPendingMap, showToast, t],
  );

  // ── Mark attendance ───────────────────────────────────────────────────────
  const handleMark = async (child: ChildItem, status: Status) => {
    const previous = attendanceMap[child.id];
    if (previous === status && !pendingMap[child.id]) return;

    const classId = child.classId || (selectedClassId !== "all" ? selectedClassId : classes[0]?.id);
    if (!classId) {
      showToast(t("attendance.noClassToast"));
      return;
    }

    const userId = currentUserId();
    // Optimistic UI update
    setAttendanceMap((current) => ({ ...current, [child.id]: status }));

    if (isOnline) {
      try {
        setSyncing(true);
        await recordAttendanceBulk({
          classId,
          date: selectedDate,
          records: [{ childId: child.id, status }],
        });

        if (userId) {
          await Promise.all([
            supersedePendingForChild(userId, classId, selectedDate, child.id),
            cacheAttendance(userId, [
              {
                classId,
                date: selectedDate,
                childId: child.id,
                status,
              },
            ]),
          ]);
          await recheckPending();
          await refreshPendingMap();
        }
      } catch (err) {
        if (isNetworkFailure(err) && userId) {
          // Network dropped mid-request: fall back to offline queue instead of losing the mark!
          await queueOfflineMark(userId, classId, child.id, status);
        } else {
          setAttendanceMap((current) => {
            const copy = { ...current };
            if (previous) copy[child.id] = previous;
            else delete copy[child.id];
            return copy;
          });
          showToast(err instanceof Error ? err.message : t("attendance.saveError"));
        }
      } finally {
        setSyncing(false);
      }
    } else if (userId) {
      await queueOfflineMark(userId, classId, child.id, status);
    } else {
      setAttendanceMap((current) => {
        const copy = { ...current };
        if (previous) copy[child.id] = previous;
        else delete copy[child.id];
        return copy;
      });
      showToast(t("attendance.saveError"));
    }
  };

  // ── Mark all present ──────────────────────────────────────────────────────
  const handleMarkAllPresent = async () => {
    if (children.length === 0) return;
    const userId = currentUserId();
    const snapshot = { ...attendanceMap };
    const next = { ...attendanceMap };
    children.forEach((child) => {
      next[child.id] = "present";
    });
    setAttendanceMap(next);

    const grouped = new Map<string, string[]>();
    children.forEach((child) => {
      const classId =
        child.classId || (selectedClassId !== "all" ? selectedClassId : classes[0]?.id);
      if (!classId) return;
      const list = grouped.get(classId) ?? [];
      list.push(child.id);
      grouped.set(classId, list);
    });

    if (isOnline) {
      try {
        setSyncing(true);
        for (const [classId, childIds] of grouped) {
          await recordAttendanceBulk({
            classId,
            date: selectedDate,
            records: childIds.map((childId) => ({ childId, status: "present" as const })),
          });
          if (userId) {
            await Promise.all(
              childIds.map((childId) =>
                supersedePendingForChild(userId, classId, selectedDate, childId),
              ),
            );
          }
        }
        await recheckPending();
        showToast(t("attendance.markedAll"));
        await loadData();
      } catch (err) {
        if (isNetworkFailure(err) && userId) {
          setSavingLocally(true);
          try {
            for (const [classId, childIds] of grouped) {
              for (const childId of childIds) {
                await enqueueAttendance({
                  operationId: uuidv4(),
                  userId,
                  classId,
                  date: selectedDate,
                  childId,
                  status: "present",
                });
              }
            }
            await recheckPending();
            await refreshPendingMap();
            showToast(t("offline.savedOffline"));
          } finally {
            setSavingLocally(false);
          }
        } else {
          setAttendanceMap(snapshot);
          showToast(err instanceof Error ? err.message : t("attendance.saveError"));
        }
      } finally {
        setSyncing(false);
      }
    } else if (userId) {
      setSavingLocally(true);
      try {
        for (const [classId, childIds] of grouped) {
          for (const childId of childIds) {
            await enqueueAttendance({
              operationId: uuidv4(),
              userId,
              classId,
              date: selectedDate,
              childId,
              status: "present",
            });
          }
        }
        await recheckPending();
        await refreshPendingMap();
        showToast(t("offline.savedOffline"));
      } finally {
        setSavingLocally(false);
      }
    }
  };

  // ── Manual sync / retry ───────────────────────────────────────────────────
  const handleManualSync = async () => {
    if (!isOnline) return;
    setSyncing(true);
    const result = await syncNow({ includeFailed: true });
    setSyncing(false);
    if (result.failed === 0) {
      showToast(t("offline.bar.synced"));
      await loadData();
    } else {
      showToast(t("offline.bar.failed"));
    }
    await refreshPendingMap();
  };

  const handleDismissFailed = async () => {
    const userId = currentUserId();
    if (!userId) return;
    await dismissFailedOps(userId);
    await recheckPending();
    await loadData();
  };

  // ── Export ────────────────────────────────────────────────────────────────
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
              {!isOnline && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#92400e",
                    background: "#fef3c7",
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    padding: "4px 10px",
                  }}
                >
                  <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("offline.badge")}
                </span>
              )}
              {offlineQueueCount > 0 && isOnline && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
                  {failedQueueCount > 0 ? t("offline.bar.retry") : t("offline.syncButton")} ({offlineQueueCount})
                </button>
              )}
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
                disabled={syncing || savingLocally || children.length === 0}
              >
                <Check className="h-4 w-4" aria-hidden="true" /> {t("attendance.markAll")}
              </button>
            </>
          }
        />

        {/* Failed sync banner */}
        {failedQueueCount > 0 && (
          <div
            className="notice danger"
            role="alert"
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              <AlertTriangle className="h-4 w-4" style={{ display: "inline", marginInlineEnd: 6 }} aria-hidden="true" />
              {t("offline.failedBanner", { count: failedQueueCount })}
              {failedErrorMsg && failedErrorMsg !== "network error" ? ` (${failedErrorMsg})` : ""}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {isOnline && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleManualSync}
                  disabled={syncing}
                >
                  {t("offline.bar.retry")}
                </button>
              )}
              <button
                type="button"
                className="btn ghost sm"
                onClick={handleDismissFailed}
                disabled={syncing}
              >
                {t("offline.dismissFailed")}
              </button>
            </div>
          </div>
        )}

        {/* Pending offline queue banner */}
        {offlineQueueCount > 0 && offlineQueueCount > failedQueueCount && (
          <div
            className="notice warn"
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span>
              <WifiOff className="h-4 w-4" style={{ display: "inline", marginInlineEnd: 6 }} aria-hidden="true" />
              {t("offline.queueBanner", { count: offlineQueueCount - failedQueueCount })}
            </span>
            {isOnline && (
              <button
                type="button"
                className="btn sm"
                onClick={handleManualSync}
                disabled={syncing}
              >
                {t("offline.syncButton")}
              </button>
            )}
          </div>
        )}

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
              <p>
                {isOnline
                  ? t("attendance.recordHint")
                  : t("attendance.recordHintOffline")}
              </p>
            </div>
            {syncing ? <Badge tone="warn">{t("attendance.saving")}</Badge> : null}
            {savingLocally ? <Badge tone="warn">{t("offline.savingLocally")}</Badge> : null}
            {!isOnline ? (
              <Badge tone="warn">
                <WifiOff className="h-3 w-3" aria-hidden="true" /> {t("offline.badge")}
              </Badge>
            ) : null}
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
                const queueInfo = pendingMap[child.id];
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

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {queueInfo && (
                          <span
                            title={queueInfo.error || t("offline.savedOffline")}
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: queueInfo.state === "failed" ? "#fee2e2" : "#fef3c7",
                              color: queueInfo.state === "failed" ? "#991b1b" : "#92400e",
                              border: `1px solid ${queueInfo.state === "failed" ? "#fca5a5" : "#fcd34d"}`,
                              borderRadius: 6,
                              padding: "2px 6px",
                            }}
                          >
                            {queueInfo.state === "failed"
                              ? t("offline.failedBadge")
                              : queueInfo.state === "syncing"
                                ? t("offline.bar.syncing")
                                : t("offline.pendingBadge")}
                          </span>
                        )}
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

        {/* Sessions section — hidden offline since we have no cached data for it */}
        {isOnline && (
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
        )}
      </main>

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}
