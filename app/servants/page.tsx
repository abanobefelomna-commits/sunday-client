"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import {
  getServants,
  createServant,
  deleteServant,
  getClasses,
  uploadServantAvatar,
  deleteServantAvatar,
  getImageUrl,
  getStoredUser,
  getChildren,
  bookServantVisitation,
  type AuthUser,
  type ClassItem,
  type ServantItem,
} from "../lib/api";

const ROLE_COLORS: Record<string, string> = {
  "خادم": "#3b6ff5",
  "خادم فقرة عامة": "#0ea5b7",
  "قائد فصل": "#e8a317",
  "مسؤول": "#d64545",
  "أب كاهن": "#8b5cf6",
  "خادم رئيسي": "#e8a317",
  "مشرف": "#2fa36b",
};

export default function ServantsPage() {
  const [servants, setServants] = useState<ServantItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("خادم");
  const [classId, setClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingServantId, setBookingServantId] = useState("");
  const [bookingChildren, setBookingChildren] = useState<Array<{ id: string; name: string }>>([]);
  const [bookingChildId, setBookingChildId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingSaving, setBookingSaving] = useState(false);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const isAdminOrPriest =
    currentUser?.role === "admin" ||
    currentUser?.role === "priest" ||
    currentUser?.servantRole === "مسؤول" ||
    currentUser?.servantRole === "أب كاهن";

  const openBooking = async () => {
    try {
      const result = await getChildren({ limit: 100 });
      setBookingChildren(result.data.map(({ id, name }) => ({ id, name })));
      setBookingChildId(result.data[0]?.id || "");
      setBookingServantId(servants[0]?.id || "");
      setBookingDate(new Date().toISOString().slice(0, 10));
      setBookingOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load children");
    }
  };

  const handleBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bookingServantId || !bookingChildId || !bookingDate) return;
    setBookingSaving(true);
    try {
      await bookServantVisitation({ childId: bookingChildId, servantId: bookingServantId, date: bookingDate });
      toast.success("تم حجز الزيارة بنجاح");
      setBookingOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book visitation");
    } finally {
      setBookingSaving(false);
    }
  };

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

  useEffect(() => {
    getClasses()
      .then((items) => {
        setClasses(items);
        setClassId(items[0]?.id || "");
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "تعذر تحميل الفصول");
      });
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
    setName("");
    setPhone("");
    setEmail("");
    setRole("خادم");
    setClassId(classes[0]?.id || "");
    setSelectedFile(null);
    setFilePreview(null);
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
      const savedServant = await createServant({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        role,
        classIds: ["خادم", "قائد فصل"].includes(role) ? [classId] : [],
      });

      // Upload avatar if selected
      if (selectedFile) {
        await uploadServantAvatar(savedServant.id, selectedFile);
      }

      setShowModal(false);
      toast.success("تم إضافة الخادم بنجاح ✓");
      fetchServants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ بيانات الخادم";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async (id: string) => {
    try {
      await deleteServantAvatar(id);
      toast.success("تم حذف صورة الخادم بنجاح ✓");
      fetchServants();
    } catch {
      toast.error("فشل حذف الصورة");
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminOrPriest) {
      toast.error("غير مسموح بحذف الخدام، الصلاحية للمسؤول أو الكاهن فقط.");
      setDeletingId(null);
      return;
    }
    try {
      await deleteServant(id);
      setDeletingId(null);
      toast.success("تم حذف الخادم بنجاح ✓");
      fetchServants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل حذف الخادم، يتطلب صلاحية مسؤول أو كاهن.";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Header with title and management actions */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              الخدام
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              أشخاص يضعون وقتهم ومحبتهم في خدمة الأحد وبناء أولاد الكنيسة.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdminOrPriest && (
              <button
                type="button"
                onClick={openBooking}
                disabled={!servants.length}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-red-900/15 transition hover:bg-red-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="حجز زيارة"
              >
                <CalendarPlus size={18} aria-hidden="true" />
                <span>حجز</span>
              </button>
            )}
            {isAdminOrPriest && (
              <button type="button" className="fab2" onClick={openAddModal} aria-label="إضافة خادم جديد" title="إضافة خادم جديد">
                +
              </button>
            )}
          </div>
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
              const hasAvatar = !!s.avatar;
              const featuredRole = ["قائد فصل", "مسؤول", "أب كاهن"].includes(s.role);

              return (
                <article
                  key={s.id}
                  className={`pc ${
                    s.role === "قائد فصل"
                      ? "border-2 border-amber-400 bg-amber-50/70 dark:bg-amber-950/20"
                      : s.role === "مسؤول"
                        ? "border-2 border-rose-400 bg-rose-50/70 dark:bg-rose-950/20"
                        : s.role === "أب كاهن"
                          ? "border-2 border-violet-400 bg-violet-50/70 dark:bg-violet-950/20 shadow-lg"
                          : ""
                  }`}
                >
                  {hasAvatar ? (
                    <img
                      src={getImageUrl(s.avatar)}
                      alt={s.name}
                      className="av2"
                      style={{
                        ["--c" as string]: color,
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    <span className="av2" style={{ ["--c" as string]: color }}>
                      {initial}
                    </span>
                  )}

                  <div className="pi">
                    <small>
                      <span
                        className="cb"
                        style={{
                          ["--c" as string]: color,
                          ...(featuredRole ? { fontWeight: 800, padding: "4px 10px" } : {}),
                        }}
                      >
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
                    {s.classes && s.classes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.classes.map((c) => (
                          <span
                            key={c.id}
                            className="text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md font-semibold"
                          >
                            🏫 {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="ac">
                    {hasAvatar && isAdminOrPriest && (
                      <button
                        type="button"
                        className="ib hover:text-orange-500 hover:border-orange-500"
                        onClick={() => handleRemoveAvatar(s.id)}
                        aria-label="حذف صورة الخادم"
                        title="حذف الصورة"
                      >
                        🖼
                      </button>
                    )}
                    {isAdminOrPriest && (
                      <button
                        type="button"
                        className="ib hover:text-red-500 hover:border-red-500"
                        onClick={() => setDeletingId(s.id)}
                        aria-label="حذف الخادم"
                        title="حذف الخادم"
                      >
                        🗑
                      </button>
                    )}
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

      {bookingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form onSubmit={handleBooking} className="f text-right w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">حجز زيارة</h3>
              <button type="button" className="ib" onClick={() => setBookingOpen(false)} aria-label="إغلاق">×</button>
            </div>
            <p className="text-sm text-slate-500">اختر الخادم والطفل وموعد الزيارة.</p>
            <div>
              <label htmlFor="booking-servant">الخادم</label>
              <select id="booking-servant" required value={bookingServantId} onChange={(event) => setBookingServantId(event.target.value)}>
                {servants.map((servant) => <option key={servant.id} value={servant.id}>{servant.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="booking-child">الطفل</label>
              <select id="booking-child" required value={bookingChildId} onChange={(event) => setBookingChildId(event.target.value)} disabled={!bookingChildren.length}>
                {bookingChildren.length ? bookingChildren.map((child) => <option key={child.id} value={child.id}>{child.name}</option>) : <option value="">No children available</option>}
              </select>
            </div>
            <div>
              <label htmlFor="booking-date">التاريخ</label>
              <input id="booking-date" type="date" required min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} />
            </div>
            <button type="submit" className="btn big w-full" disabled={bookingSaving || !bookingChildId}>
              {bookingSaving ? "جارٍ الحجز…" : "تأكيد الحجز"}
            </button>
          </form>
        </div>
      )}

      {/* Add Servant Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
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
              {/* Avatar Upload Section */}
              <div className="flex justify-center">
                <div
                  className="relative w-28 h-28 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition overflow-hidden group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={saving}
                    className="hidden"
                  />

                  {filePreview ? (
                    <>
                      <img
                        src={filePreview}
                        alt="معاينة"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-white text-xs font-bold">تغيير</span>
                      </div>
                      <button
                        type="button"
                        className="absolute -top-1 -left-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg hover:bg-red-700 transition z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFilePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <span className="text-2xl block">📷</span>
                      <p className="text-xs text-slate-500 mt-1">صورة شخصية</p>
                    </div>
                  )}
                </div>
              </div>

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
                  <option value="خادم فقرة عامة">خادم فقرة عامة</option>
                  <option value="قائد فصل">قائد فصل</option>
                  <option value="مسؤول">مسؤول</option>
                  <option value="أب كاهن">أب كاهن</option>
                  <option value="خادم رئيسي">خادم رئيسي (أمين أسرة)</option>
                  <option value="مشرف">مشرف عام</option>
                </select>
              </div>

              {["خادم", "قائد فصل"].includes(role) && (
                <div>
                  <label htmlFor="s_class">الفصل</label>
                  <select
                    id="s_class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    disabled={saving || classes.length === 0}
                    required
                  >
                    {classes.map((classItem) => (
                      <option key={classItem.id} value={classItem.id}>
                        {classItem.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
