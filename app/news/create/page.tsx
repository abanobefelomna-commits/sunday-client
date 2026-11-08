"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import { createNews, getStoredToken, getStoredUser } from "../../lib/api";

export default function CreateNewsPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const user = getStoredUser();
    setAllowed(!!user && ["admin", "priest", "مسؤول", "أب كاهن"].includes(user.role));
  }, []);
  useEffect(() => { if (!file) { setPreview(""); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  async function publish(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    if (!content.trim()) { setError("اكتب محتوى الخبر قبل النشر."); return; }
    setSaving(true);
    try { await createNews({ title: title.trim() || undefined, content: content.trim(), imageFile: file }, getStoredToken() || undefined); router.push("/"); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر نشر الخبر. حاول مرة أخرى."); }
    finally { setSaving(false); }
  }
  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-28"><AppHeader /><main className="pg max-w-2xl mx-auto px-4">
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8" dir="rtl">
      <h1 className="mb-1 text-2xl font-extrabold text-slate-900 dark:text-white">إضافة خبر</h1><p className="mb-6 text-sm text-slate-500">اكتب الخبر وشاركه مع أسرة مدارس الأحد.</p>
      {!allowed ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">النشر متاح للمسؤول والكاهن بعد تسجيل الدخول.</p> : <form onSubmit={publish} className="space-y-4">
        <label className="block text-sm font-bold">عنوان الخبر<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 font-normal dark:border-slate-700" /></label>
        <label className="block text-sm font-bold">صورة الخبر<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label>
        {preview && <img src={preview} alt="معاينة صورة الخبر" className="max-h-80 w-full rounded-2xl object-cover" />}
        <label className="block text-sm font-bold">محتوى الخبر<textarea required value={content} onChange={e=>setContent(e.target.value)} rows={9} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 font-normal leading-8 dark:border-slate-700" /></label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3"><button disabled={saving} className="btn disabled:opacity-50">{saving ? "جارٍ النشر…" : "نشر الخبر"}</button><button type="button" onClick={()=>router.push("/")} className="rounded-xl border px-4 py-2">إلغاء</button></div>
      </form>}
    </section>
  </main><BottomNav /></div>;
}
