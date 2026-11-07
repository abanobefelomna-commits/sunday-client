"use client";

import { useEffect, useState, type FormEvent } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { getStoredUser, getStoredToken, type AuthUser } from "../lib/api";

type Prep = { serverName?: string; attendanceChecked: boolean; lessonTopic: string; prepDate: string };
const isPrivileged = (user: AuthUser | null) => !!user && ["admin", "priest"].includes(user.role) || !!user && ["مسؤول", "أب كاهن"].includes(user.servantRole || "");

export default function FridayPrepPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<Prep[]>([]);
  const [topic, setTopic] = useState("");
  const [prepDate, setPrepDate] = useState("");
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const friday = new Date().getDay() === 5;
  const privileged = isPrivileged(user);

  const load = async () => {
    const res = await fetch("/api/friday-prep", { headers: { Authorization: `Bearer ${getStoredToken() || ""}` }, cache: "no-store" });
    if (!res.ok) throw new Error("تعذر تحميل التحضير");
    const result = await res.json();
    setRows(result.data);
  };
  useEffect(() => { setUser(getStoredUser()); load().catch((e) => setError(e.message)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setSaved(false);
    const res = await fetch("/api/friday-prep", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken() || ""}` }, body: JSON.stringify({ attendanceChecked: checked, lessonTopic: topic, prepDate }) });
    if (!res.ok) { const body = await res.json().catch(() => ({})); setError(body.message || "تعذر حفظ التحضير"); return; }
    setSaved(true); await load();
  }

  return <><AppHeader /><main className="mx-auto min-h-screen max-w-5xl px-4 py-8 pb-28"><h1 className="mb-6 text-3xl font-black text-slate-900 dark:text-white">{privileged ? "لوحة متابعة التحضير" : "تحضير الجمعة"}</h1>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}{saved && <p role="status" className="mb-4 rounded-lg bg-green-100 p-3 text-green-800">تم حفظ التحضير بنجاح</p>}
    {privileged ? <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table className="w-full text-right"><thead><tr className="border-b dark:border-slate-700"><th className="p-4">اسم الخادم</th><th className="p-4">الحضور</th><th className="p-4">موضوع الدرس</th><th className="p-4">يوم التحضير</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.serverName}-${r.prepDate}-${i}`} className="border-b last:border-0 dark:border-slate-700"><td className="p-4">{r.serverName}</td><td className="p-4">{r.attendanceChecked ? "تم" : "لم يتم"}</td><td className="p-4">{r.lessonTopic}</td><td className="p-4">{new Date(r.prepDate).toLocaleDateString("ar-EG")}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="p-8 text-center text-slate-500">لا توجد تحضيرات مسجلة</td></tr>}</tbody></table></div> : friday ? <form onSubmit={submit} className="grid max-w-xl gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><label className="flex items-center gap-3"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} required />تأكيد مراجعة الحضور</label><label className="grid gap-2">موضوع الدرس<input className="rounded-lg border p-3 text-slate-900" value={topic} onChange={e => setTopic(e.target.value)} required /></label><label className="grid gap-2">يوم التحضير<input type="date" className="rounded-lg border p-3 text-slate-900" value={prepDate} onChange={e => setPrepDate(e.target.value)} required /></label><button className="rounded-lg bg-amber-500 p-3 font-bold text-white">حفظ التحضير</button></form> : <p className="rounded-xl bg-amber-50 p-6 text-amber-900">نموذج التحضير متاح للخدام يوم الجمعة فقط.</p>}
  </main><BottomNav /></>;
}
