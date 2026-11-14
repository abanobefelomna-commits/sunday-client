"use client";

import { useEffect, useState, type FormEvent } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { getStoredUser, getStoredToken, type AuthUser } from "../lib/api";
import { useI18n } from "../lib/app-i18n";
import { formatDateFor, formatDateTimeFor } from "../lib/format";

type Prep = {
  id: string;
  serverName?: string;
  attendanceChecked: boolean;
  lessonTopic: string;
  prepDate: string;
  content: string;
  submittedAt: string;
  status: string;
};

const STATUS_KEYS: Record<string, string> = {
  submitted: "fridayPrep.status.submitted",
  pending: "fridayPrep.status.pending",
  reviewed: "fridayPrep.status.reviewed",
  draft: "fridayPrep.status.draft",
};

const isPrivileged = (user: AuthUser | null) =>
  (!!user && ["admin", "priest"].includes(user.role)) ||
  (!!user && ["مسؤول", "أب كاهن"].includes(user.servantRole || ""));

export default function FridayPrepPage() {
  const { t, locale } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<Prep[]>([]);
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [prepDate, setPrepDate] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [friday, setFriday] = useState(false);
  const privileged = isPrivileged(user);

  const visibleRows = rows.filter(
    (row) =>
      (!search ||
        row.serverName?.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
      (!filterDate || row.prepDate.slice(0, 10) === filterDate),
  );

  const load = async () => {
    const res = await fetch("/api/friday-prep", {
      headers: { Authorization: `Bearer ${getStoredToken() || ""}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error("load");
    const result = await res.json();
    setRows(result.data);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUser(getStoredUser());
      setFriday(
        new Intl.DateTimeFormat("en-US", {
          timeZone: "Africa/Cairo",
          weekday: "short",
        }).format(new Date()) === "Fri",
      );
      load().catch(() => setError(t("fridayPrep.loadError")));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/friday-prep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken() || ""}`,
        },
        body: JSON.stringify({
          attendanceChecked: checked,
          lessonTopic: topic,
          prepDate,
          content,
        }),
      });
      if (!res.ok) throw new Error("save");
      setSaved(true);
      await load();
    } catch {
      setError(t("fridayPrep.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const statusLabel = (status: string) => {
    const key = STATUS_KEYS[status];
    return key ? t(key as Parameters<typeof t>[0]) : status;
  };

  return (
    <>
      <AppHeader />
      <main className="pg max-w-5xl">
        <h1 className="mb-6 text-2xl font-black text-slate-900 sm:text-3xl dark:text-white">
          {privileged ? t("fridayPrep.dashboardTitle") : t("fridayPrep.title")}
        </h1>

        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-100 p-3 text-red-800">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mb-4 rounded-lg bg-green-100 p-3 text-green-800">
            {t("fridayPrep.saved")}
          </p>
        )}

        {privileged ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <input
                aria-label={t("fridayPrep.searchAria")}
                placeholder={t("fridayPrep.searchPlaceholder")}
                className="min-h-11 w-full rounded-lg border p-3"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <input
                aria-label={t("fridayPrep.filterAria")}
                type="date"
                className="min-h-11 w-full rounded-lg border p-3"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="grid gap-4">
              {visibleRows.map((row) => (
                <details
                  key={row.id}
                  className="rounded-xl border bg-white p-4 dark:bg-slate-900"
                >
                  <summary className="cursor-pointer font-bold">
                    {row.serverName} — {row.lessonTopic}
                    <span className="mt-1 block text-sm font-normal text-slate-500">
                      {t("fridayPrep.prepDate", { date: formatDateFor(row.prepDate, locale) })}
                      {" · "}
                      {t("fridayPrep.submittedAt", {
                        date: formatDateTimeFor(row.submittedAt, locale),
                      })}
                      {" · "}
                      {statusLabel(row.status)}
                    </span>
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap break-words">{row.content}</div>
                  <p className="mt-2">
                    {t("fridayPrep.reviewAttendance")}{" "}
                    {row.attendanceChecked ? t("fridayPrep.done") : t("fridayPrep.notDone")}
                  </p>
                </details>
              ))}
              {!visibleRows.length && (
                <p className="rounded-xl bg-slate-100 p-8 text-center dark:bg-slate-800">
                  {t("fridayPrep.noRows")}
                </p>
              )}
            </div>
          </>
        ) : (
          <form
            onSubmit={submit}
            className={`grid max-w-xl gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 ${
              !friday ? "opacity-60" : ""
            }`}
          >
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
              {t("fridayPrep.available")}{" "}
              {friday ? t("fridayPrep.formOpen") : t("fridayPrep.opensFriday")}
            </p>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                required
                disabled={!friday}
              />
              {t("fridayPrep.confirmAttendance")}
            </label>
            <label className="grid gap-2">
              {t("fridayPrep.topic")}
              <input
                className="min-h-11 rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
                disabled={!friday}
              />
            </label>
            <label className="grid gap-2">
              {t("fridayPrep.date")}
              <input
                type="date"
                className="min-h-11 rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed"
                value={prepDate}
                onChange={(e) => setPrepDate(e.target.value)}
                required
                disabled={!friday}
              />
            </label>
            <label className="grid gap-2">
              {t("fridayPrep.content")}
              <textarea
                className="rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed"
                rows={5}
                placeholder={t("fridayPrep.contentPlaceholder")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                disabled={!friday}
              />
            </label>
            <button
              type="submit"
              title={!friday ? t("fridayPrep.opensFriday") : undefined}
              disabled={!friday || saving}
              className="min-h-11 rounded-lg bg-amber-500 p-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? t("fridayPrep.saving") : t("fridayPrep.submit")}
            </button>
          </form>
        )}
      </main>
      <BottomNav />
    </>
  );
}
