"use client";

import { useEffect, useState, useTransition } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getChildren,
  getClasses,
  getAttendance,
  recordAttendanceBulk,
  type ChildItem,
  type ClassItem,
  type AttendanceRecord,
} from "../lib/api";

const GRADE_COLORS: Record<string, string> = {
  first: "#e8a317",
  second: "#3b6ff5",
  third: "#2fa36b",
  fourth: "#d64545",
  fifth: "#8b5cf6",
  sixth: "#0ea5b7",
};

export default function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, "present" | "absent">>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [resCl, resCh, resAtt] = await Promise.all([
        getClasses(),
        getChildren({
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
          limit: 200,
        }),
        getAttendance(
          selectedClassId !== "all" ? selectedClassId : undefined,
          selectedDate,
        ),
      ]);

      setClasses(resCl);
      setChildren(resCh.data);

      const map: Record<string, "present" | "absent"> = {};
      resAtt.forEach((a: AttendanceRecord) => {
        if (a.status === "present" || a.status === "absent") {
          map[a.childId] = a.status;
        }
      });
      setAttendanceMap(map);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedClassId]);

  // Change date by offset (-1 for yesterday, +1 for tomorrow)
  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const iso = d.toISOString().slice(0, 10);
    if (iso <= today) {
      setSelectedDate(iso);
    }
  };

  // Toggle single child status
  const handleMark = async (child: ChildItem, status: "present" | "absent") => {
    const prev = attendanceMap[child.id];
    if (prev === status) return;

    // Optimistic UI update
    setAttendanceMap((m) => ({ ...m, [child.id]: status }));

    try {
      setSyncing(true);
      const classId = child.classId || classes[0]?.id;
      if (!classId) return;

      await recordAttendanceBulk({
        classId,
        date: selectedDate,
        records: [{ childId: child.id, status }],
      });
    } catch {
      // Rollback on failure
      setAttendanceMap((m) => {
        const copy = { ...m };
        if (prev) copy[child.id] = prev;
        else delete copy[child.id];
        return copy;
      });
      showToast("تعذر حفظ الحضور في الخادم");
    } finally {
      setSyncing(false);
    }
  };

  // Mark all filtered children as present
  const handleMarkAllPresent = async () => {
    if (children.length === 0) return;

    const newMap = { ...attendanceMap };
    children.forEach((c) => {
      newMap[c.id] = "present";
    });
    setAttendanceMap(newMap);

    try {
      setSyncing(true);
      // Group by classId
      const grouped: Record<string, string[]> = {};
      children.forEach((c) => {
        const cid = c.classId || classes[0]?.id;
        if (cid) {
          grouped[cid] = grouped[cid] || [];
          grouped[cid].push(c.id);
        }
      });

      for (const [classId, childIds] of Object.entries(grouped)) {
        await recordAttendanceBulk({
          classId,
          date: selectedDate,
          records: childIds.map((id) => ({ childId: id, status: "present" })),
        });
      }
      showToast("تم تسجيل الكل حاضر بنجاح ✓");
    } catch {
      showToast("حدث خطأ أثناء حفظ الكل حاضر");
      loadData();
    } finally {
      setSyncing(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (children.length === 0) return;
    const rows = [
      ["التاريخ", "اسم الطفل", "الفصل", "الحالة"],
      ...children.map((c) => [
        selectedDate,
        c.name,
        c.class?.name || "بدون فصل",
        attendanceMap[c.id] === "present"
          ? "حاضر"
          : attendanceMap[c.id] === "absent"
          ? "غايب"
          : "لم يسجل بعد",
      ]),
    ];

    const csvContent =
      "\ufeff" + rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("تم تصدير ملف الحضور ✓");
  };

  // Calculation counts
  const total = children.length;
  const presentCount = children.filter((c) => attendanceMap[c.id] === "present").length;
  const absentCount = children.filter((c) => attendanceMap[c.id] === "absent").length;
  const pendingCount = Math.max(0, total - presentCount - absentCount);
  const percent = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  const dateFormatted = new Date(selectedDate + "T12:00:00").toLocaleDateString(
    "ar-EG",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Header & Action Buttons */}
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              سجل الحضور والغياب
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">{dateFormatted}</p>
          </div>

          <div className="row2">
            <button
              type="button"
              className="btn ghost sm"
              onClick={handleExport}
              disabled={children.length === 0}
            >
              تصدير CSV
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={handleMarkAllPresent}
              disabled={syncing || children.length === 0}
            >
              الكل حاضر
            </button>
          </div>
        </div>

        {/* Date Navigator Picker */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="ib"
            onClick={() => changeDate(-1)}
            aria-label="اليوم السابق"
            title="اليوم السابق"
          >
            ›
          </button>

          <input
            type="date"
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-slate-900 dark:text-slate-100 font-medium text-sm shadow-sm"
            value={selectedDate}
            max={today}
            onChange={(e) => {
              if (e.target.value && e.target.value <= today) {
                setSelectedDate(e.target.value);
              }
            }}
            aria-label="تاريخ الحضور"
          />

          <button
            type="button"
            className="ib"
            onClick={() => changeDate(1)}
            disabled={selectedDate >= today}
            aria-label="اليوم التالي"
            title="اليوم التالي"
          >
            ‹
          </button>
        </div>

        {/* Class Filter Chips */}
        <div className="chips">
          <button
            type="button"
            className={`chip ${selectedClassId === "all" ? "on" : ""}`}
            onClick={() => setSelectedClassId("all")}
          >
            كل الفصول
          </button>

          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${selectedClassId === c.id ? "on" : ""}`}
              onClick={() => setSelectedClassId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Progress Summary Card */}
        <div className="card">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            <b className="text-2xl text-blue-600 dark:text-blue-400 font-extrabold">{presentCount}</b> حاضر،{" "}
            <b className="text-2xl text-red-600 dark:text-red-400 font-extrabold">{absentCount}</b> غايب،{" "}
            <span className="text-slate-500">{pendingCount} لم يُسجل بعد</span>
          </div>

          <div className="bar2 mt-3 mb-1">
            <i style={{ width: `${percent}%` }}></i>
          </div>
          <small className="text-xs text-slate-400">نسبة الحضور: {percent}%</small>
        </div>

        {/* Children Rows with Quick Toggle Buttons */}
        <div className="card">
          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ تحميل قائمة الأطفال...</div>
          ) : children.length > 0 ? (
            children.map((child) => {
              const grade = child.class?.grade || "first";
              const color = GRADE_COLORS[grade] || "#3b6ff5";
              const status = attendanceMap[child.id];

              return (
                <div key={child.id} className="row">
                  <div className="flex items-center gap-3">
                    <span className="av2 text-sm font-bold" style={{ ["--c" as string]: color }}>
                      {child.name.charAt(0)}
                    </span>
                    <div>
                      <b className="block text-slate-900 dark:text-slate-100">{child.name}</b>
                      <small className="text-slate-500">{child.class?.name || "بدون فصل"}</small>
                    </div>
                  </div>

                  <span className="flex gap-2">
                    <button
                      type="button"
                      className={`pl ${status === "present" ? "p" : ""}`}
                      onClick={() => handleMark(child, "present")}
                      disabled={syncing}
                    >
                      حاضر
                    </button>
                    <button
                      type="button"
                      className={`pl ${status === "absent" ? "a" : ""}`}
                      onClick={() => handleMark(child, "absent")}
                      disabled={syncing}
                    >
                      غايب
                    </button>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400">
              لا يوجد أطفال في هذا الفصل لعرض سجل حضورهم.
            </div>
          )}
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <BottomNav />
    </div>
  );
}
