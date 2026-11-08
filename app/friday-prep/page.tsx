"use client";

import { useEffect, useState, type FormEvent } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { getStoredUser, getStoredToken, type AuthUser } from "../lib/api";

type Prep = { id: string; serverName?: string; attendanceChecked: boolean; lessonTopic: string; prepDate: string; content: string; submittedAt: string; status: string };
const isPrivileged = (user: AuthUser | null) => !!user && ["admin", "priest"].includes(user.role) || !!user && ["مسؤول", "أب كاهن"].includes(user.servantRole || "");

export default function FridayPrepPage() {
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
  const visibleRows = rows.filter((row) => (!search || row.serverName?.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar"))) && (!filterDate || row.prepDate.slice(0, 10) === filterDate));

  const load = async () => {
    const res = await fetch("/api/friday-prep", { headers: { Authorization: `Bearer ${getStoredToken() || ""}` }, cache: "no-store" });
    if (!res.ok) throw new Error("تعذر تحميل التحضير");
    const result = await res.json();
    setRows(result.data);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setUser(getStoredUser());
      setFriday(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(new Date()) === "Fri");
      load().catch((e) => setError(e.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setSaved(false); setSaving(true);
    try {
      const res = await fetch("/api/friday-prep", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken() || ""}` }, body: JSON.stringify({ attendanceChecked: checked, lessonTopic: topic, prepDate, content }) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "تعذر حفظ التحضير"); }
      setSaved(true); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ التحضير"); }
    finally { setSaving(false); }
  }

  return <><AppHeader /><main className="mx-auto min-h-screen max-w-5xl px-4 py-8 pb-28"><h1 className="mb-6 text-3xl font-black text-slate-900 dark:text-white">{privileged ? "لوحة متابعة التحضير" : "تحضير الجمعة"}</h1>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}{saved && <p role="status" className="mb-4 rounded-lg bg-green-100 p-3 text-green-800">تم حفظ التحضير بنجاح</p>}
    {privileged ? <><div className="mb-4 grid gap-3 sm:grid-cols-2"><input aria-label="بحث باسم الخادم" placeholder="ابحث باسم الخادم" className="rounded-lg border p-3" value={search} onChange={e => setSearch(e.target.value)} /><input aria-label="تصفية بتاريخ التحضير" type="date" className="rounded-lg border p-3" value={filterDate} onChange={e => setFilterDate(e.target.value)} /></div><div className="grid gap-4">{visibleRows.map(r => <details key={r.id} className="rounded-xl border bg-white p-4 dark:bg-slate-900"><summary className="cursor-pointer font-bold">{r.serverName} — {r.lessonTopic}<span className="block text-sm font-normal text-slate-500">تحضير {new Date(r.prepDate).toLocaleDateString("ar-EG")} · إرسال {new Date(r.submittedAt).toLocaleString("ar-EG")} · {r.status}</span></summary><div className="mt-3 whitespace-pre-wrap">{r.content}</div><p className="mt-2">مراجعة الحضور: {r.attendanceChecked ? "تم" : "لم يتم"}</p></details>)}{!visibleRows.length && <p className="rounded-xl bg-slate-100 p-8 text-center">لا توجد تحضيرات مسجلة تطابق البحث.</p>}</div></> : <form onSubmit={submit} className={`grid max-w-xl gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 ${!friday ? "opacity-60" : ""}`}><p className="rounded-lg bg-amber-50 p-3 text-amber-900">التحضير متاح للإرسال يوم الجمعة فقط. {friday ? "النموذج مفتوح." : "يفتح التحضير يوم الجمعة."}</p><label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} required disabled={!friday} />تأكيد مراجعة الحضور</label><label className="grid gap-2">عنوان الدرس<input className="rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed" value={topic} onChange={e => setTopic(e.target.value)} required disabled={!friday} /></label><label className="grid gap-2">تاريخ التحضير<input type="date" className="rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed" value={prepDate} onChange={e => setPrepDate(e.target.value)} required disabled={!friday} /></label><label className="grid gap-2">تفاصيل التحضير<textarea className="rounded-lg border p-3 text-slate-900 disabled:cursor-not-allowed" rows={5} value={content} onChange={e => setContent(e.target.value)} required disabled={!friday} /></label><button type="submit" title={!friday ? "يفتح التحضير يوم الجمعة" : undefined} disabled={!friday || saving} className="rounded-lg bg-amber-500 p-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{saving ? "جارٍ الإرسال..." : "إرسال التحضير"}</button></form>}
  </main><BottomNav /></>;
}
