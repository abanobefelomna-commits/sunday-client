"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { getStoredToken } from "../lib/api";

type ClassRow = {
  id: string;
  name: string;
  grade: string;
  academicYear: string | null;
  sortOrder: number;
};

type ChildRow = {
  id: string;
  name: string;
  birthDate: string;
  classId: string | null;
  className: string | null;
};

type HistoryRow = {
  id: string;
  childId: string;
  childName: string;
  fromClassName: string | null;
  toClassName: string | null;
  academicYear: string;
  promotedByName: string | null;
  promotedAt: string;
};

export default function PromotionPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useCallback(() => {
    const token = getStoredToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/promotion?history=true", { headers: authHeaders() });
      const body = (await response.json()) as {
        classes?: ClassRow[];
        history?: HistoryRow[];
        message?: string;
      };
      if (!response.ok) throw new Error(body.message || "تعذر جلب بيانات الترقية");
      setClasses(body.classes || []);
      setHistory(body.history || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر جلب بيانات الترقية");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadBase();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadBase]);

  const loadChildren = useCallback(
    async (classId: string) => {
      if (!classId) {
        setChildren([]);
        return;
      }
      try {
        const response = await fetch(
          `/api/promotion?classId=${encodeURIComponent(classId)}`,
          { headers: authHeaders() },
        );
        const body = (await response.json()) as {
          children?: ChildRow[];
          message?: string;
        };
        if (!response.ok) throw new Error(body.message || "تعذر جلب أطفال الفصل");
        setChildren(body.children || []);
        setSelected(new Set());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر جلب أطفال الفصل");
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadChildren(fromClassId);
    });
    return () => cancelAnimationFrame(frame);
  }, [fromClassId, loadChildren]);

  const selectedChildren = useMemo(
    () => children.filter((child) => selected.has(child.id)),
    [children, selected],
  );

  const toggleChild = (childId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  };

  const toggleAll = () => {
    if (children.length === 0) return;
    if (selected.size === children.length) setSelected(new Set());
    else setSelected(new Set(children.map((child) => child.id)));
  };

  const submit = async () => {
    if (!academicYear.trim()) {
      toast.error("اكتب العام الدراسي");
      return;
    }
    if (!toClassId) {
      toast.error("اختر الفصل المستقبل");
      return;
    }
    if (selectedChildren.length === 0) {
      toast.error("اختر طفلًا واحدًا على الأقل");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/promotion", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          academicYear: academicYear.trim(),
          promotions: selectedChildren.map((child) => ({
            childId: child.id,
            toClassId,
          })),
        }),
      });
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message || "تعذر تنفيذ الترقية");
      toast.success(body.message || "تمت الترقية بنجاح");
      setSelected(new Set());
      await loadBase();
      if (fromClassId) await loadChildren(fromClassId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر تنفيذ الترقية");
    } finally {
      setSaving(false);
    }
  };

  const destinationClass = classes.find((item) => item.id === toClassId) || null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />
      <main className="pg">
        <Link href="/classes" className="hint inline-block mb-1">
          ← العودة إلى الفصول
        </Link>

        <div className="card">
          <div className="ch">
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                ترقية الفصول السنوية
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                اختر الأطفال ثم الفصل المستقبل. تبقى سجلات الحضور السابقة محفوظة.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-sm font-medium mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ التحميل...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="fld">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    من الفصل
                  </label>
                  <select
                    value={fromClassId}
                    onChange={(event) => setFromClassId(event.target.value)}
                    className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                  >
                    <option value="">اختر الفصل الحالي</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fld">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    إلى الفصل
                  </label>
                  <select
                    value={toClassId}
                    onChange={(event) => setToClassId(event.target.value)}
                    className="h-12 rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                  >
                    <option value="">اختر الفصل المستقبل</option>
                    {classes
                      .filter((item) => item.id !== fromClassId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="fld">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  العام الدراسي
                </label>
                <input
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                  placeholder="مثال: 2026/2027"
                  className="h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 text-sm"
                />
              </div>

              {fromClassId && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <b className="text-sm text-slate-800 dark:text-slate-100">
                      أطفال الفصل ({children.length})
                    </b>
                    <button type="button" onClick={toggleAll} className="btn ghost sm">
                      {selected.size === children.length && children.length > 0
                        ? "إلغاء الكل"
                        : "تحديد الكل"}
                    </button>
                  </div>
                  {children.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">
                      لا يوجد أطفال في هذا الفصل.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-auto">
                      {children.map((child) => (
                        <label
                          key={child.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(child.id)}
                            onChange={() => toggleChild(child.id)}
                            className="h-4 w-4"
                          />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {child.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedChildren.length > 0 && (
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-3">
                  <b className="block text-sm text-blue-800 dark:text-blue-200 mb-1">
                    معاينة الترقية ({selectedChildren.length})
                  </b>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    {destinationClass
                      ? `إلى: ${destinationClass.name}`
                      : "اختر الفصل المستقبل لعرض المعاينة"}
                  </p>
                  <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                    {selectedChildren.map((child) => (
                      <li key={child.id} className="flex justify-between gap-2">
                        <span>{child.name}</span>
                        <span className="text-blue-700 dark:text-blue-300">
                          {child.className || "بدون فصل"}
                          {destinationClass ? ` ← ${destinationClass.name}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || selectedChildren.length === 0 || !toClassId}
                className="btn big w-full"
              >
                {saving ? "جارٍ تنفيذ الترقية..." : "تأكيد الترقية"}
              </button>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="card">
            <div className="ch">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                سجل الترقيات
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-right text-xs text-slate-500">
                    <th className="py-2">الطفل</th>
                    <th className="py-2">من</th>
                    <th className="py-2">إلى</th>
                    <th className="py-2">العام</th>
                    <th className="py-2">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-2 font-semibold">{row.childName}</td>
                      <td className="py-2">{row.fromClassName || "—"}</td>
                      <td className="py-2">{row.toClassName || "—"}</td>
                      <td className="py-2">{row.academicYear}</td>
                      <td className="py-2">{row.promotedByName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
