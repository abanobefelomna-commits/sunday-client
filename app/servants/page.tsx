"use client";

import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getServants,
  createServant,
  deleteServant,
  type ServantItem,
} from "../lib/api";

const ROLE_COLORS: Record<string, string> = {
  "خادم": "#3b6ff5",
  "خادم رئيسي": "#e8a317",
  "مشرف": "#2fa36b",
  "admin": "#d64545",
  "priest": "#8b5cf6",
};

export default function ServantsPage() {
  const [servants, setServants] = useState<ServantItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("خادم");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchServants = async () => {
    try {
      setLoading(true);
      const res = await getServants(search.trim() || undefined);
      setServants(res.data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServants();
  }, [search]);

  const openAddModal = () => {
    setName("");
    setPhone("");
    setEmail("");
    setRole("خادم");
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("يرجى إدخال اسم الخادم ورقم الهاتف.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createServant({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        role,
      });
      setShowModal(false);
      fetchServants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ بيانات الخادم";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteServant(id);
      setDeletingId(null);
      fetchServants();
    } catch {
      alert("فشل حذف الخادم، يتطلب صلاحية مسؤول أو كاهن.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Header with Title and Add Button */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              الخدام
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              أشخاص يضعون وقتهم ومحبتهم في خدمة الأحد وبناء أولاد الكنيسة.
            </p>
          </div>

          <button
            type="button"
            className="fab2"
            onClick={openAddModal}
            aria-label="إضافة خادم جديد"
            title="إضافة خادم جديد"
          >
            +
          </button>
        </div>

        {/* Search Input */}
        <label className="sb">
          <span aria-hidden="true">🔍</span>
          <input
            placeholder="ابحث في أسماء الخدام وأرقام الهواتف…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث في الخدام"
          />
        </label>

        {/* Servants List */}
        <div className="lst">
          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ تحميل قائمة الخدام...</div>
          ) : servants.length > 0 ? (
            servants.map((s) => {
              const color = ROLE_COLORS[s.role] || "#3b6ff5";
              const initial = s.name.replace(/^أ\. /, "").trim().charAt(0) || "خ";

              return (
                <article key={s.id} className="pc">
                  <span className="av2" style={{ ["--c" as string]: color }}>
                    {initial}
                  </span>

                  <div className="pi">
                    <small>
                      <span className="cb" style={{ ["--c" as string]: color }}>
                        {s.role}
                      </span>
                    </small>
                    <b className="text-slate-900 dark:text-slate-100 mt-0.5">{s.name}</b>
                    <span>
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                          dir="ltr"
                        >
                          {s.phone}
                        </a>
                      ) : (
                        "الهاتف غير متوفر"
                      )}
                    </span>
                    {s.email && (
                      <span className="text-xs text-slate-400" dir="ltr">
                        {s.email}
                      </span>
                    )}
                  </div>

                  <div className="ac">
                    <button
                      type="button"
                      className="ib hover:text-red-500 hover:border-red-500"
                      onClick={() => setDeletingId(s.id)}
                      aria-label="حذف الخادم"
                      title="حذف"
                    >
                      🗑
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="card text-center py-12">
              <span className="text-4xl block mb-2">🤝</span>
              <b className="block text-slate-800 dark:text-slate-100 text-lg">
                لا يوجد خدام مسجلين بعد
              </b>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                {search ? "لم يتم العثور على نتائج للبحث." : "ابدأ بإضافة أول خادم لمجموعة الخدمة."}
              </p>
              <button type="button" className="btn" onClick={openAddModal}>
                إضافة خادم جديد
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Servant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                إضافة خادم جديد
              </h3>
              <button
                type="button"
                className="ib"
                onClick={() => setShowModal(false)}
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="f text-right space-y-4">
              <div>
                <label htmlFor="s_name">اسم الخادم</label>
                <input
                  id="s_name"
                  type="text"
                  required
                  placeholder="مثال: أ. مينا سامي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="s_phone">رقم الموبايل</label>
                <input
                  id="s_phone"
                  type="tel"
                  required
                  dir="ltr"
                  placeholder="012..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="s_email">البريد الإلكتروني (اختياري)</label>
                <input
                  id="s_email"
                  type="email"
                  dir="ltr"
                  placeholder="servant@church.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="s_role">الدور في الخدمة</label>
                <select
                  id="s_role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={saving}
                >
                  <option value="خادم">خادم فصل</option>
                  <option value="خادم رئيسي">خادم رئيسي (أمين أسرة)</option>
                  <option value="مشرف">مشرف عام</option>
                </select>
              </div>

              {error && <p className="msg err">{error}</p>}

              <button
                type="submit"
                className="btn big w-full mt-4 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? "جارٍ الإضافة..." : "حفظ بيانات الخادم"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
            <span className="text-4xl block mb-2">⚠️</span>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              تأكيد حذف الخادم؟
            </h4>
            <p className="text-sm text-slate-500 mb-6">
              هل أنت متأكد من حذف هذا الخادم من سجل الخدمة؟
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(deletingId)}
              >
                حذف الخادم
              </button>
              <button
                type="button"
                className="btn ghost flex-1"
                onClick={() => setDeletingId(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
