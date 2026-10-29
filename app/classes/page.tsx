"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { toast } from "sonner";
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  uploadClassImage,
  deleteClassImage,
  getImageUrl,
  type ClassItem,
} from "../lib/api";

const GRADE_PALETTES = [
  "linear-gradient(135deg, #e8a317, #f59e0b)",
  "linear-gradient(135deg, #3b6ff5, #60a5fa)",
  "linear-gradient(135deg, #2fa36b, #34d399)",
  "linear-gradient(135deg, #d64545, #f87171)",
  "linear-gradient(135deg, #8b5cf6, #a78bfa)",
  "linear-gradient(135deg, #0ea5b7, #38bdf8)",
];

const GRADES = [
  { value: "first", label: "سنة أولى ابتدائي" },
  { value: "second", label: "سنة ثانية ابتدائي" },
  { value: "third", label: "سنة ثالثة ابتدائي" },
  { value: "fourth", label: "سنة رابعة ابتدائي" },
  { value: "fifth", label: "سنة خامسة ابتدائي" },
  { value: "sixth", label: "سنة سادسة ابتدائي" },
  { value: "general", label: "فقرة عامة" },
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("first");
  const [academicYear, setAcademicYear] = useState("2026/2027");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const res = await getClasses();
      setClasses(res);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  const openAddModal = () => {
    setEditingClass(null);
    setName("");
    setGrade("first");
    setAcademicYear("2026/2027");
    setSelectedFile(null);
    setFilePreview(null);
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (c: ClassItem) => {
    setEditingClass(c);
    setName(c.name);
    setGrade(c.grade);
    setAcademicYear(c.academicYear);
    setSelectedFile(null);
    setFilePreview(c.image ? getImageUrl(c.image) : null);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("يرجى إدخال اسم الفصل.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let savedClass: ClassItem;
      if (editingClass) {
        savedClass = await updateClass(editingClass.id, {
          name: name.trim(),
          grade,
          academicYear,
        });
      } else {
        savedClass = await createClass({
          name: name.trim(),
          grade,
          academicYear,
        });
      }

      // Upload image if selected
      if (selectedFile) {
        await uploadClassImage(savedClass.id, selectedFile);
      }

      setShowModal(false);
      toast.success(editingClass ? "تم تعديل الفصل بنجاح ✓" : "تم إنشاء الفصل بنجاح ✓");
      fetchClasses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ بيانات الفصل";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveImage = async (classId: string) => {
    try {
      await deleteClassImage(classId);
      toast.success("تم حذف صورة الفصل بنجاح ✓");
      fetchClasses();
    } catch {
      toast.error("فشل حذف الصورة");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClass(id);
      setDeletingId(null);
      toast.success("تم حذف الفصل بنجاح ✓");
      fetchClasses();
    } catch {
      toast.error("فشل حذف الفصل، يتطلب صلاحية مسؤول أو كاهن.");
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
              الفصول
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              مساحات صغيرة ينمو فيها الإيمان والمحبة والصداقة.
            </p>
          </div>

          <button
            type="button"
            className="fab2"
            onClick={openAddModal}
            aria-label="إضافة فصل جديد"
            title="إضافة فصل جديد"
          >
            +
          </button>
        </div>

        {/* Classes List */}
        <div className="grid gap-3">
          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ تحميل الفصول...</div>
          ) : classes.length > 0 ? (
            classes.map((c, idx) => {
              const bgGradient = GRADE_PALETTES[idx % GRADE_PALETTES.length];
              const hasImage = !!c.image;

              return (
                <article key={c.id} className="cc">
                  <Link
                    href={`/classes/${c.id}`}
                    className="cv text-white font-bold"
                    style={{
                      background: hasImage ? undefined : bgGradient,
                      padding: 0,
                      overflow: "hidden",
                    }}
                  >
                    {hasImage ? (
                      <img
                        src={getImageUrl(c.image)}
                        alt={c.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      "📖"
                    )}
                  </Link>

                  <div className="ci2">
                    <small>فصل مدارس الأحد</small>
                    <Link
                      href={`/classes/${c.id}`}
                      className="text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition"
                    >
                      {c.name}
                    </Link>
                    <span>المرحلة: {c.grade} · السنة الدراسية: {c.academicYear}</span>
                    <span>
                      {c.childrenCount ?? (c.children?.length || 0)} أطفال ·{" "}
                      {c.servantsCount ?? (c.servants?.length || 0)} خدام
                    </span>
                  </div>

                  <div className="ac">
                    <button
                      type="button"
                      className="ib"
                      onClick={() => openEditModal(c)}
                      aria-label="تعديل الفصل"
                      title="تعديل"
                    >
                      ✎
                    </button>
                    {c.image && (
                      <button
                        type="button"
                        className="ib hover:text-orange-500 hover:border-orange-500"
                        onClick={() => handleRemoveImage(c.id)}
                        aria-label="حذف صورة الفصل"
                        title="حذف الصورة"
                      >
                        🖼
                      </button>
                    )}
                    <button
                      type="button"
                      className="ib hover:text-red-500 hover:border-red-500"
                      onClick={() => setDeletingId(c.id)}
                      aria-label="حذف الفصل"
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
              <span className="text-4xl block mb-2">📚</span>
              <b className="block text-slate-800 dark:text-slate-100 text-lg">
                لا توجد فصول مسجلة بعد
              </b>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                ابدأ بإنشاء أول فصل لمدارس الأحد الآن.
              </p>
              <button type="button" className="btn" onClick={openAddModal}>
                إضافة فصل جديد
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Class Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {editingClass ? "تعديل الفصل" : "إضافة فصل جديد"}
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
                <label htmlFor="cl_name">اسم الفصل</label>
                <input
                  id="cl_name"
                  type="text"
                  required
                  placeholder="مثال: فصل القديس أبانوب (سنة رابعة)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="cl_grade">المرحلة الدراسية</label>
                <select
                  id="cl_grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  disabled={saving}
                >
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cl_year">السنة الدراسية</label>
                <input
                  id="cl_year"
                  type="text"
                  placeholder="2026/2027"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Image Upload Section */}
              <div>
                <label htmlFor="cl_img">صورة غلاف الفصل (اختياري)</label>
                <div
                  className="relative mt-1 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="cl_img"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={saving}
                    className="hidden"
                  />

                  {filePreview ? (
                    <div className="relative">
                      <img
                        src={filePreview}
                        alt="معاينة"
                        className="w-full max-h-40 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        className="absolute top-2 left-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-lg hover:bg-red-700 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFilePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <span className="text-3xl block mb-2">📷</span>
                      <p className="text-sm text-slate-500">
                        اضغط لاختيار صورة غلاف للفصل
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        JPG, PNG, WEBP · أقصى حجم 5 ميجا
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="msg err">{error}</p>}

              <button
                type="submit"
                className="btn big w-full mt-4 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? "جارٍ الحفظ..." : "حفظ الفصل"}
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
              تأكيد حذف الفصل؟
            </h4>
            <p className="text-sm text-slate-500 mb-6">
              حذف الفصل سيؤدي لإزالة ارتباط الأطفال به.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                className="btn flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(deletingId)}
              >
                حذف الفصل
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
