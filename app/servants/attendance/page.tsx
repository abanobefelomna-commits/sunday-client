"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import { getClass, getStoredToken, type ClassItem } from "../../lib/api";
import { shiftIso, todayIso } from "../../lib/format";

type Status = "present" | "absent" | "late" | "excused";

type AttendanceRow = {
  id: string;
  servantId: string;
  date: string;
  status: Status;
  recordedByName: string | null;
  servant: { id: string; name: string };
  class: { id: string; name: string };
};

type Summary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type ServantStat = {
  servantId: string;
  servantName: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

const EMPTY_SUMMARY: Summary = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };

const STATUSES: Array<{ value: Status; label: string; className: string }> = [
  { value: "present", label: "حاضر", className: "bg-emerald-600 text-white" },
  { value: "absent", label: "غائب", className: "bg-red-600 text-white" },
  { value: "late", label: "متأخر", className: "bg-amber-500 text-white" },
  { value: "excused", label: "بعذر", className: "bg-violet-600 text-white" },
];

const STATUS_LABELS: Record<Status, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "بعذر",
};

const STATUS_TEXT: Record<Status, string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  absent: "text-red-600 dark:text-red-400",
  late: "text-amber-600 dark:text-amber-400",
  excused: "text-violet-600 dark:text-violet-400",
};

function attendanceRate(stat: ServantStat): number {
  if (stat.total === 0) return 0;
  return Math.round(((stat.present + stat.late) / stat.total) * 100);
}

export default function ServantAttendancePage() {
  const [classId, setClassId] = useState("");
  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [date, setDate] = useState(todayIso());
  const [records, setRecords] = useState<Record<string, AttendanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [historyFrom, setHistoryFrom] = useState(shiftIso(todayIso(), -30));
  const [historyTo, setHistoryTo] = useState(todayIso());
  const [historyRows, setHistoryRows] = useState<AttendanceRow[]>([]);
  const [historySummary, setHistorySummary] = useState<Summary>(EMPTY_SUMMARY);
  const [byServant, setByServant] = useState<ServantStat[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setClassId(new URLSearchParams(window.location.search).get("classId") || "");
    });
  }, []);

  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!classId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      getClass(classId)
        .then((data) => {
          if (active) setClassData(data);
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : "تعذر جلب الفصل");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [classId]);

  const loadAttendance = useCallback(async () => {
    if (!classId) return;
    try {
      const token = getStoredToken();
      const response = await fetch(
        `/api/servants/attendance?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      const body = (await response.json()) as {
        data?: AttendanceRow[];
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "تعذر جلب سجلات الحضور");
      const next: Record<string, AttendanceRow> = {};
      for (const row of body.data || []) next[row.servantId] = row;
      setRecords(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر جلب سجلات الحضور");
    }
  }, [classId, date]);

  useEffect(() => {
    void Promise.resolve().then(() => loadAttendance());
  }, [loadAttendance]);

  const loadHistory = useCallback(async () => {
    if (!classId) return;
    setHistoryLoading(true);
    try {
      const token = getStoredToken();
      const params = new URLSearchParams({
        classId,
        dateFrom: historyFrom,
        dateTo: historyTo,
        limit: "200",
      });
      const response = await fetch(`/api/servants/attendance?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await response.json()) as {
        data?: AttendanceRow[];
        summary?: Summary;
        byServant?: ServantStat[];
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "تعذر جلب سجل الحضور");
      setHistoryRows(body.data || []);
      setHistorySummary(body.summary || EMPTY_SUMMARY);
      setByServant(body.byServant || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر جلب سجل الحضور");
    } finally {
      setHistoryLoading(false);
    }
  }, [classId, historyFrom, historyTo]);

  useEffect(() => {
    void Promise.resolve().then(() => loadHistory());
  }, [loadHistory]);

  const servants = useMemo(() => classData?.servants || [], [classData]);

  const counts = useMemo(() => {
    const result = { present: 0, absent: 0, late: 0, excused: 0, pending: 0 };
    for (const servant of servants) {
      const status = records[servant.id]?.status;
      if (status) result[status] += 1;
      else result.pending += 1;
    }
    return result;
  }, [records, servants]);

  const mark = async (servantId: string, status: Status) => {
    const existing = records[servantId];
    const previous = records;
    setSavingId(servantId);
    setRecords((current) => ({
      ...current,
      [servantId]: {
        ...(current[servantId] || {
          id: "",
          servantId,
          date,
          recordedByName: null,
          servant: { id: servantId, name: "" },
          class: { id: classId, name: classData?.name || "" },
        }),
        status,
      },
    }));
    try {
      const token = getStoredToken();
      const response = await fetch("/api/servants/attendance", {
        method: existing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          existing
            ? { id: existing.id, status }
            : { servantId, classId, date, status },
        ),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "تعذر حفظ الحضور");
      toast.success("تم حفظ الحضور");
      await loadAttendance();
      await loadHistory();
    } catch (err) {
      setRecords(previous);
      toast.error(err instanceof Error ? err.message : "تعذر حفظ الحضور");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />
      <main className="pg">
        <Link href={classId ? `/classes/${classId}` : "/classes"} className="hint inline-block mb-1">
          ← العودة إلى الفصل
        </Link>

        <div className="card">
          <div className="ch">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                حضور الخدام
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {classData?.name || "اختر فصلًا من صفحة الفصل"}
              </p>
            </div>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 px-3 text-sm"
              aria-label="تاريخ الحضور"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm font-medium mb-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-center">
            {[
              { label: "حاضر", value: counts.present, color: "text-emerald-600" },
              { label: "غائب", value: counts.absent, color: "text-red-600" },
              { label: "متأخر", value: counts.late, color: "text-amber-600" },
              { label: "بعذر", value: counts.excused, color: "text-violet-600" },
              { label: "لم يُسجّل", value: counts.pending, color: "text-slate-500" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-2">
                <span className={`block text-lg font-extrabold ${item.color}`}>{item.value}</span>
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ التحميل...</div>
          ) : !classId ? (
            <div className="text-center py-10 text-slate-400">اختر فصلًا من صفحة الفصل أولًا.</div>
          ) : servants.length === 0 ? (
            <div className="text-center py-10 text-slate-400">لا يوجد خدام معيّنون لهذا الفصل.</div>
          ) : (
            <div className="space-y-2">
              {servants.map((servant) => {
                const current = records[servant.id]?.status;
                const isSaving = savingId === servant.id;
                const isLeader =
                  classData?.leadServantId === servant.id || servant.role === "قائد فصل";
                return (
                  <div
                    key={servant.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border p-3 ${
                      isLeader
                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-800/60 dark:bg-amber-950/20"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <b className="text-slate-900 dark:text-slate-100">{servant.name}</b>
                      <span className="block text-xs text-slate-500">
                        {isLeader ? "قائد الفصل" : servant.role}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((status) => (
                        <button
                          key={status.value}
                          type="button"
                          disabled={isSaving}
                          onClick={() => void mark(servant.id, status.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            current === status.value
                              ? status.className
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          } disabled:opacity-60`}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="ch">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                سجل وإحصاءات الحضور
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                احتساب الحضور والغياب خلال الفترة المحددة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="fld">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                من تاريخ
              </label>
              <input
                type="date"
                value={historyFrom}
                onChange={(event) => setHistoryFrom(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 px-3 text-sm"
              />
            </div>
            <div className="fld">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                إلى تاريخ
              </label>
              <input
                type="date"
                value={historyTo}
                onChange={(event) => setHistoryTo(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-center">
            {[
              { label: "إجمالي السجلات", value: historySummary.total, color: "text-slate-700 dark:text-slate-200" },
              { label: "حاضر", value: historySummary.present, color: "text-emerald-600" },
              { label: "غائب", value: historySummary.absent, color: "text-red-600" },
              { label: "متأخر", value: historySummary.late, color: "text-amber-600" },
              { label: "بعذر", value: historySummary.excused, color: "text-violet-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-2">
                <span className={`block text-lg font-extrabold ${item.color}`}>{item.value}</span>
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>

          {historyLoading ? (
            <div className="text-center py-8 text-slate-400">جارٍ تحميل السجل...</div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto mb-4">
                <table className="w-full text-sm min-w-[36rem]">
                  <thead>
                    <tr className="text-right text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40">
                      <th className="px-3 py-2">الخادم</th>
                      <th className="px-3 py-2">السجلات</th>
                      <th className="px-3 py-2">حاضر</th>
                      <th className="px-3 py-2">غائب</th>
                      <th className="px-3 py-2">متأخر</th>
                      <th className="px-3 py-2">بعذر</th>
                      <th className="px-3 py-2">نسبة الحضور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byServant.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                          لا توجد سجلات في هذه الفترة.
                        </td>
                      </tr>
                    ) : (
                      byServant.map((stat) => (
                        <tr key={stat.servantId} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">
                            {stat.servantName}
                          </td>
                          <td className="px-3 py-2">{stat.total}</td>
                          <td className="px-3 py-2 text-emerald-600">{stat.present}</td>
                          <td className="px-3 py-2 text-red-600">{stat.absent}</td>
                          <td className="px-3 py-2 text-amber-600">{stat.late}</td>
                          <td className="px-3 py-2 text-violet-600">{stat.excused}</td>
                          <td className="px-3 py-2 font-bold">{attendanceRate(stat)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                آخر السجلات
              </h3>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-sm min-w-[32rem]">
                  <thead>
                    <tr className="text-right text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40">
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">الخادم</th>
                      <th className="px-3 py-2">الحالة</th>
                      <th className="px-3 py-2">سجّلها</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                          لا توجد سجلات في هذه الفترة.
                        </td>
                      </tr>
                    ) : (
                      historyRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2" dir="ltr">
                            {row.date}
                          </td>
                          <td className="px-3 py-2 font-semibold">{row.servant.name}</td>
                          <td className={`px-3 py-2 font-bold ${STATUS_TEXT[row.status]}`}>
                            {STATUS_LABELS[row.status]}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {row.recordedByName || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
