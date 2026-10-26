"use client";

import { useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getChildren,
  getClasses,
  createChild,
  updateChild,
  deleteChild,
  type ChildItem,
  type ClassItem,
} from "../lib/api";

const GRADE_COLORS: Record<string, string> = {
  first: "#e8a317",
  second: "#3b6ff5",
  third: "#2fa36b",
  fourth: "#d64545",
  fifth: "#8b5cf6",
  sixth: "#0ea5b7",
};

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formParentName, setFormParentName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formGender, setFormGender] = useState<"male" | "female">("male");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resCh, resCl] = await Promise.all([
        getChildren({
          search: search.trim() || undefined,
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
        }),
        getClasses(),
      ]);
      setChildren(resCh.data);
      setClasses(resCl);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, selectedClassId]);

  const openAddModal = () => {
    setEditingChild(null);
    setFormName("");
    setFormClassId(classes[0]?.id || "");
    setFormPhone("");
    setFormParentName("");
    setFormAddress("");
    setFormNotes("");
    setFormGender("male");
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (child: ChildItem) => {
    setEditingChild(child);
    setFormName(child.name);
    setFormClassId(child.classId || classes[0]?.id || "");
    setFormPhone(child.parentPhone || child.phone || "");
    setFormParentName(child.parentName || "");
    setFormAddress(child.address || "");
    setFormNotes(child.notes || "");
    setFormGender(child.gender || "male");
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      setFormError("يرجى إدخال اسم الطفل ورقم هاتف ولي الأمر.");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingChild) {
        await updateChild(editingChild.id, {
          name: formName.trim(),
          classId: formClassId || undefined,
          parentPhone: formPhone.trim(),
          parentName: formParentName.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
          gender: formGender,
        });
      } else {
        await createChild({
          name: formName.trim(),
          classId: formClassId || undefined,
          parentPhone: formPhone.trim(),
          parentName: formParentName.trim() || undefined,
          address: formAddress.trim() || undefined,
          notes: formNotes.trim() || undefined,
          gender: formGender,
        });
      }

      setShowModal(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ بيانات الطفل";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteChild(id);
      setDeletingId(null);
      fetchData();
    } catch {
      alert("فشل حذف الطفل، قد يتطلب صلاحية مسؤول أو كاهن.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Title Header with Add Button */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              الأطفال
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              دليل الأطفال المسجلين في خدمة مدارس الأحد.
            </p>
          </div>

          <button
            type="button"
            className="fab2"
            onClick={openAddModal}
            aria-label="إضافة طفل جديد"
            title="إضافة طفل جديد"
          >
            +
          </button>
        </div>

        {/* Search Input */}
        <label className="sb">
          <span aria-hidden="true">🔍</span>
          <input
            placeholder="ابحث في أسماء الأطفال وأرقام الهواتف…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث في الأطفال"
          />
        </label>

        {/* Class Filter Chips */}
        <div className="chips">
          <button
            type="button"
            className={`chip ${selectedClassId === "all" ? "on" : ""}`}
            onClick={() => setSelectedClassId("all")}
          >
            الكل ({children.length})
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

        {/* Children List */}
        <div className="lst">
          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ تحميل بيانات الأطفال...</div>
          ) : children.length > 0 ? (
            children.map((child) => {
              const grade = child.class?.grade || "first";
              const color = GRADE_COLORS[grade] || "#3b6ff5";

              return (
                <article key={child.id} className="pc">
                  <span className="av2" style={{ ["--c" as string]: color }}>
                    {child.name.charAt(0)}
                  </span>

                  <div className="pi">
                    <small>
                      <span className="cb" style={{ ["--c" as string]: color }}>
                        {child.class?.name || "بدون فصل"}
                      </span>
                    </small>
                    <b className="text-slate-900 dark:text-slate-100 mt-0.5">{child.name}</b>
                    <span>
                      {child.parentPhone ? (
                        <a
                          href={`tel:${child.parentPhone}`}
                          className="hover:underline text-blue-600 dark:text-blue-400"
                          dir="ltr"
                        >
                          {child.parentPhone}
                        </a>
                      ) : (
                        "الهاتف غير متوفر"
                      )}
                    </span>
                    {child.parentName && (
                      <span className="text-xs text-slate-400">
                        ولي الأمر: {child.parentName}
                      </span>
                    )}
                  </div>

                  <div className="ac">
                    <button
                      type="button"
                      className="ib"
                      onClick={() => openEditModal(child)}
                      aria-label="تعديل بيانات الطفل"
                      title="تعديل"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="ib hover:text-red-500 hover:border-red-500"
                      onClick={() => setDeletingId(child.id)}
                      aria-label="حذف الطفل"
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
              <span className="text-4xl block mb-2">🧒</span>
              <b className="block text-slate-800 dark:text-slate-100 text-lg">
                لا يوجد أطفال مسجلين
              </b>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                {search ? "لم يتم العثور على أطفال يطابقون بحثك." : "ابدأ بإضافة أول طفل لمجموعتك الآن."}
              </p>
              <button type="button" className="btn" onClick={openAddModal}>
                إضافة طفل جديد
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Child Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingChild ? "تعديل بيانات الطفل" : "إضافة طفل جديد"}
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

            <form onSubmit={handleSave} className="f text-right space-y-3">
              <div>
                <label htmlFor="c_name">اسم الطفل الكامل</label>
                <input
                  id="c_name"
                  type="text"
                  required
                  placeholder="مثال: يوسف هاني فهمي"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="c_class">الفصل أو المرحلة</label>
                <select
                  id="c_class"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  disabled={saving}
                >
                  <option value="">بدون فصل محدد</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="c_phone">رقم هاتف ولي الأمر</label>
                  <input
                    id="c_phone"
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="010..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label htmlFor="c_parent">اسم ولي الأمر</label>
                  <input
                    id="c_parent"
                    type="text"
                    placeholder="اسم الأب أو الأم"
                    value={formParentName}
                    onChange={(e) => setFormParentName(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="c_gender">النوع</label>
                <select
                  id="c_gender"
                  value={formGender}
                  onChange={(e) => setFormGender(e.target.value as "male" | "female")}
                  disabled={saving}
                >
                  <option value="male">ولد 👦</option>
                  <option value="female">بنت 👧</option>
                </select>
              </div>

              <div>
                <label htmlFor="c_notes">ملاحظات خاصة أو عنوان</label>
                <textarea
                  id="c_notes"
                  rows={2}
                  placeholder="أي ملاحظات صحية أو عنوان السكن..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  disabled={saving}
                />
              </div>

              {formError && <p className="msg err">{formError}</p>}

              <button
                type="submit"
                className="btn big w-full mt-4 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? "جارٍ الحفظ..." : "حفظ البيانات"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
            <span className="text-4xl block mb-2">⚠️</span>
            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
              تأكيد حذف الطفل؟
            </h4>
            <p className="text-sm text-slate-500 mb-6">
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذه الخطوة.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
              >
                {deleting ? "جارٍ الحذف..." : "حذف السجل"}
              </button>
              <button
                type="button"
                className="btn ghost flex-1"
                onClick={() => setDeletingId(null)}
                disabled={deleting}
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
