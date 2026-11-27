"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { useI18n } from "../lib/app-i18n";
import {
  createClassProblem,
  getClassProblems,
  getClasses,
  updateClassProblem,
  type ClassItem,
  type ClassProblemItem,
  type ClassProblemPriority,
  type ClassProblemStatus,
} from "../lib/api";

const STR = {
  ar: {
    title: "مشاكل الفصول وطلبات المساعدة",
    subtitle: "أبلغ عن مشكلة في فصلك أو اطلب دعمًا، ويتابعها المسؤولون حتى الحل.",
    reportTitle: "أبلغ عن مشكلة",
    category: "نوع المشكلة",
    title2: "عنوان مختصر",
    titlePlaceholder: "مثال: نقص أدوات في فصل الرابع",
    description: "الوصف",
    descriptionPlaceholder: "اشرح المشكلة أو الطلب بوضوح…",
    priority: "الأولوية",
    classLabel: "الفصل",
    classPlaceholder: "اختر الفصل",
    submit: "إرسال البلاغ",
    submitting: "جارٍ الإرسال…",
    sent: "تم إرسال البلاغ",
    listTitle: "البلاغات",
    empty: "لا توجد بلاغات حاليًا",
    all: "الكل",
    loading: "جارٍ التحميل…",
    failed: "تعذر التحميل",
    retry: "إعادة المحاولة",
    saveNote: "حفظ الرد",
    notePlaceholder: "رد أو ملاحظة على البلاغ…",
    noteSaved: "تم حفظ الرد",
    updated: "تم تحديث البلاغ",
    by: "بواسطة",
    statuses: {
      new: "جديد",
      in_progress: "قيد المتابعة",
      resolved: "تم الحل",
      closed: "مغلق",
    },
    priorities: {
      low: "منخفضة",
      medium: "متوسطة",
      high: "عالية",
      urgent: "عاجلة",
    },
    categories: {
      class_issue: "مشكلة في الفصل",
      missing_resource: "نقص مورد أو أدوات",
      student_issue: "مشكلة تخص طالب",
      attendance_issue: "مشكلة حضور",
      technical_issue: "مشكلة تقنية",
      support_request: "طلب دعم",
      general_request: "طلب عام",
      other: "أخرى",
    },
  },
  en: {
    title: "Class problems and support requests",
    subtitle: "Report a problem in your class or ask for support; leaders follow it up until it is resolved.",
    reportTitle: "Report a problem",
    category: "Type",
    title2: "Short title",
    titlePlaceholder: "e.g. Missing materials in grade four",
    description: "Description",
    descriptionPlaceholder: "Explain the problem or request clearly…",
    priority: "Priority",
    classLabel: "Class",
    classPlaceholder: "Choose class",
    submit: "Send report",
    submitting: "Sending…",
    sent: "Report sent",
    listTitle: "Reports",
    empty: "No reports yet",
    all: "All",
    loading: "Loading…",
    failed: "Failed to load",
    retry: "Retry",
    saveNote: "Save reply",
    notePlaceholder: "Reply or note on this report…",
    noteSaved: "Reply saved",
    updated: "Report updated",
    by: "by",
    statuses: {
      new: "New",
      in_progress: "In progress",
      resolved: "Resolved",
      closed: "Closed",
    },
    priorities: {
      low: "Low",
      medium: "Medium",
      high: "High",
      urgent: "Urgent",
    },
    categories: {
      class_issue: "Class issue",
      missing_resource: "Missing resource",
      student_issue: "Student-related issue",
      attendance_issue: "Attendance issue",
      technical_issue: "Technical problem",
      support_request: "Support request",
      general_request: "General request",
      other: "Other",
    },
  },
} as const;

const STATUS_ORDER: ClassProblemStatus[] = ["new", "in_progress", "resolved", "closed"];

const STATUS_STYLE: Record<ClassProblemStatus, string> = {
  new: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  closed: "bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
};

const PRIORITY_STYLE: Record<ClassProblemPriority, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
};

export default function ClassProblemsPage() {
  const { locale } = useI18n();
  const s = locale === "ar" ? STR.ar : STR.en;

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState("");
  const [category, setCategory] = useState("class_issue");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ClassProblemPriority>("medium");
  const [reporting, setReporting] = useState(false);

  const [filter, setFilter] = useState<ClassProblemStatus | "all">("all");
  const [reports, setReports] = useState<ClassProblemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async (statusFilter: ClassProblemStatus | "all") => {
    setLoading(true);
    setFailed(false);
    try {
      const [classList, reportList] = await Promise.all([
        getClasses(),
        getClassProblems({
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 100,
        }),
      ]);
      setClasses(classList);
      setReports(reportList.data || []);
      setClassId((current) => current || classList[0]?.id || "");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("all");
  }, [load]);

  const pickFilter = (next: ClassProblemStatus | "all") => {
    setFilter(next);
    void load(next);
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!classId || !title.trim() || !description.trim()) {
      toast.error(s.title2);
      return;
    }
    setReporting(true);
    try {
      await createClassProblem({
        classId,
        category: category as ClassProblemItem["category"],
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      setTitle("");
      setDescription("");
      toast.success(s.sent);
      void load(filter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : s.failed);
    } finally {
      setReporting(false);
    }
  };

  const changeStatus = async (report: ClassProblemItem, status: ClassProblemStatus) => {
    setSaving(report.id);
    try {
      await updateClassProblem(report.id, { status });
      toast.success(s.updated);
      void load(filter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : s.failed);
    } finally {
      setSaving(null);
    }
  };

  const saveNote = async (report: ClassProblemItem) => {
    setSaving(report.id);
    try {
      await updateClassProblem(report.id, { resolutionNote: notes[report.id] ?? "" });
      toast.success(s.noteSaved);
      void load(filter);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : s.failed);
    } finally {
      setSaving(null);
    }
  };

  const counts = useMemo(() => {
    const all = reports.length;
    const byStatus: Record<string, number> = { new: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const report of reports) byStatus[report.status] += 1;
    return { all, byStatus };
  }, [reports]);

  const dateLabel = (value: string) =>
    new Date(value).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 pt-6">
        <div className="mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            <ClipboardList className="h-6 w-6 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            {s.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.subtitle}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          {/* Report form */}
          <section className="card h-fit bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-5" aria-label={s.reportTitle}>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100 mb-4">
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              {s.reportTitle}
            </h2>
            <form onSubmit={submitReport} className="space-y-3 text-start">
              <div>
                <label htmlFor="cp-class" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.classLabel}</label>
                <select
                  id="cp-class"
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-sm"
                  required
                >
                  <option value="" disabled>{s.classPlaceholder}</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cp-category" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.category}</label>
                <select
                  id="cp-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-sm"
                >
                  {(Object.keys(s.categories) as Array<keyof typeof s.categories>).map((key) => (
                    <option key={key} value={key}>{s.categories[key]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="cp-title" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.title2}</label>
                <input
                  id="cp-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={s.titlePlaceholder}
                  maxLength={180}
                  required
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cp-desc" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.description}</label>
                <textarea
                  id="cp-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={s.descriptionPlaceholder}
                  maxLength={4000}
                  required
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="cp-priority" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.priority}</label>
                <select
                  id="cp-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as ClassProblemPriority)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-sm"
                >
                  {(Object.keys(s.priorities) as Array<keyof typeof s.priorities>).map((key) => (
                    <option key={key} value={key}>{s.priorities[key]}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={reporting || !classId}
                className="btn big w-full flex items-center justify-center gap-2 active:scale-[0.99] transition-transform"
              >
                {reporting ? s.submitting : s.submit}
              </button>
            </form>
          </section>

          {/* Reports list */}
          <section aria-label={s.listTitle}>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => pickFilter("all")}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${filter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
              >
                {s.all} · {reports.length}
              </button>
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => pickFilter(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold border transition-colors ${filter === status ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"}`}
                >
                  {s.statuses[status]} · {counts.byStatus[status]}
                </button>
              ))}
            </div>

            {loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.loading}</p>
            )}
            {!loading && failed && (
              <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-300 flex items-center gap-3">
                {s.failed}
                <button type="button" className="btn ghost sm" onClick={() => void load(filter)}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />{s.retry}
                </button>
              </div>
            )}
            {!loading && !failed && reports.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500 dark:text-slate-400">
                <Inbox className="mx-auto h-8 w-8 mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm font-semibold">{s.empty}</p>
              </div>
            )}
            {!loading && !failed && reports.length > 0 && (
              <div className="space-y-3">
                {reports.map((report) => (
                  <details
                    key={report.id}
                    className="card bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 open:shadow-md"
                  >
                    <summary className="cursor-pointer list-none flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[report.status]}`}>
                        {s.statuses[report.status]}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRIORITY_STYLE[report.priority]}`}>
                        {s.priorities[report.priority]}
                      </span>
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{s.categories[report.category]}</span>
                      <span className="grow text-sm font-bold text-slate-800 dark:text-slate-100">{report.title}</span>
                      {report.status === "new" && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      )}
                      {report.status === "resolved" && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                      )}
                    </summary>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p className="whitespace-pre-wrap">{report.description}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {report.class?.name} · {s.by} {report.reporter?.name} · {dateLabel(report.createdAt)}
                      </p>
                      {report.resolutionNote && (
                        <p className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 p-3 text-sm whitespace-pre-wrap">
                          {report.resolutionNote}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        {STATUS_ORDER.filter((status) => status !== report.status).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={saving === report.id}
                            onClick={() => void changeStatus(report, status)}
                            className="btn ghost sm"
                          >
                            {s.statuses[status]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        aria-label={s.notePlaceholder}
                        value={notes[report.id] ?? report.resolutionNote ?? ""}
                        onChange={(event) => setNotes((prev) => ({ ...prev, [report.id]: event.target.value }))}
                        placeholder={s.notePlaceholder}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving === report.id}
                        onClick={() => void saveNote(report)}
                        className="btn sm"
                      >
                        {saving === report.id ? s.submitting : s.saveNote}
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}