"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { Modal, PageHeader } from "../components/ui";
import { toast } from "sonner";
import { CalendarPlus, Plus, Search, Trash2 } from "lucide-react";
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
import { initials, SERVICE_ROLE_KEYS } from "../lib/format";
import { useI18n } from "../lib/app-i18n";

const ROLE_COLORS: Record<string, string> = {
  "خادم": "#3b6ff5",
  "خادم فقرة عامة": "#0ea5b7",
  "قائد فصل": "#e8a317",
  "مسؤول": "#d64545",
  "أب كاهن": "#8b5cf6",
  "خادم رئيسي": "#e8a317",
  "مشرف": "#2fa36b",
};

const SERVICE_ROLES = [
  "خادم",
  "خادم فقرة عامة",
  "قائد فصل",
  "مسؤول",
  "أب كاهن",
  "خادم رئيسي",
  "مشرف",
] as const;

const ROLE_KEYS: Record<string, string> = SERVICE_ROLE_KEYS;

export default function ServantsPage() {
  const { t } = useI18n();
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
  const bookingServantName = servants.find((servant) => servant.id === bookingServantId)?.name;

  const roleLabel = (value: string) => {
    const key = ROLE_KEYS[value];
    return key ? t(key as Parameters<typeof t>[0]) : value;
  };

  const openBooking = async (servant: ServantItem) => {
    try {
      const result = await getChildren({ limit: 100 });
      setBookingChildren(result.data.map(({ id, name }) => ({ id, name })));
      setBookingChildId(result.data[0]?.id || "");
      setBookingServantId(servant.id);
      setBookingDate(new Date().toISOString().slice(0, 10));
      setBookingOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("followUpDetail.loadError"));
    }
  };

  const handleBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bookingServantId || !bookingChildId || !bookingDate) return;
    setBookingSaving(true);
    try {
      await bookServantVisitation({ childId: bookingChildId, servantId: bookingServantId, date: bookingDate });
      toast.success(t("servants.bookSuccess"));
      setBookingOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("servants.bookError"));
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
        toast.error(err instanceof Error ? err.message : t("servants.loadClassesError"));
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
      setError(t("servants.required"));
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
      toast.success(t("servants.added"));
      fetchServants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("servants.saveError");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async (id: string) => {
    try {
      await deleteServantAvatar(id);
      toast.success(t("servants.photoDeleted"));
      fetchServants();
    } catch {
      toast.error(t("servants.photoDeleteError"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdminOrPriest) {
      toast.error(t("servants.cannotDelete"));
      setDeletingId(null);
      return;
    }
    try {
      await deleteServant(id);
      setDeletingId(null);
      toast.success(t("servants.deleted"));
      fetchServants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("servants.deleteError");
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={t("servants.roleLabel")}
          title={t("nav.servants")}
          subtitle={t("servants.subtitle")}
          actions={
            isAdminOrPriest ? (
              <button type="button" className="btn" onClick={openAddModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("servants.add")}
              </button>
            ) : null
          }
        />

        {/* Search Input */}
        <label className="sb">
          <Search className="h-4 w-4 opacity-50" aria-hidden="true" />
          <input
            placeholder={t("servants.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("servants.searchAria")}
          />
        </label>

        {/* Servants List */}
        <div className="lst">
          {loading ? (
            <div className="text-center py-10 text-slate-400">{t("servants.loading")}</div>
          ) : servants.length > 0 ? (
            servants.map((s) => {
              const color = ROLE_COLORS[s.role] || "#3b6ff5";
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
                      {initials(s.name)}
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
                        {roleLabel(s.role)}
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
                        t("servants.phoneMissing")
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

                  <div className="ac flex-row flex-wrap items-center justify-end">
                    {isAdminOrPriest && (
                      <button
                        type="button"
                        onClick={() => openBooking(s)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-red-900/15 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[.98] dark:focus-visible:ring-offset-slate-950"
                        aria-label={t("servants.bookAria", { name: s.name })}
                        title={t("servants.bookTitle")}
                      >
                        <CalendarPlus size={17} aria-hidden="true" />
                        <span>{t("servants.book")}</span>
                      </button>
                    )}
                    {hasAvatar && isAdminOrPriest && (
                      <button
                        type="button"
                        className="ib hover:text-orange-500 hover:border-orange-500"
                        onClick={() => handleRemoveAvatar(s.id)}
                        aria-label={t("servants.removePhotoAria")}
                        title={t("servants.removePhotoTitle")}
                      >
                        🖼
                      </button>
                    )}
                    {isAdminOrPriest && (
                      <button
                        type="button"
                        className="ib hover:text-red-500 hover:border-red-500"
                        onClick={() => setDeletingId(s.id)}
                        aria-label={t("servants.deleteAria")}
                        title={t("servants.deleteAria")}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                {t("servants.empty")}
              </b>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                {search ? t("servants.emptySearch") : t("servants.emptyHint")}
              </p>
              {isAdminOrPriest ? (
                <button type="button" className="btn" onClick={openAddModal}>
                  {t("servants.add")}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </main>

      {bookingOpen && (
        <Modal title={t("servants.bookTitle")} subtitle={t("servants.bookSubtitle")} onClose={() => setBookingOpen(false)}>
          <form onSubmit={handleBooking} className="f space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
              <span className="text-slate-500">{t("servants.servantLabel")}: </span>
              <strong className="text-slate-900 dark:text-slate-100">{bookingServantName}</strong>
            </div>
            <div className="fld">
              <label htmlFor="booking-child">{t("servants.childLabel")}</label>
              <select id="booking-child" required value={bookingChildId} onChange={(event) => setBookingChildId(event.target.value)} disabled={!bookingChildren.length}>
                {bookingChildren.length ? bookingChildren.map((child) => <option key={child.id} value={child.id}>{child.name}</option>) : <option value="">{t("servants.noChildren")}</option>}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="booking-date">{t("servants.dateLabel")}</label>
              <input id="booking-date" type="date" required min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} />
            </div>
            <button type="submit" className="btn big w-full" disabled={bookingSaving || !bookingChildId}>
              {bookingSaving ? t("servants.booking") : t("servants.bookConfirm")}
            </button>
          </form>
        </Modal>
      )}

      {/* Add Servant Modal */}
      {showModal && (
        <Modal title={t("servants.add")} subtitle={t("servants.subtitle")} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="f space-y-4">
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
                      alt={t("servants.photoPreview")}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{t("servants.photoChange")}</span>
                    </div>
                    <button
                      type="button"
                      className="absolute -top-1 -left-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-lg hover:bg-red-700 transition z-10"
                      aria-label={t("common.remove")}
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
                    <p className="text-xs text-slate-500 mt-1">{t("servants.photo")}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="fld">
              <label htmlFor="s_name">{t("servants.nameLabel")}</label>
              <input
                id="s_name"
                type="text"
                required
                placeholder={t("servants.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="fld">
              <label htmlFor="s_phone">{t("servants.phoneLabel")}</label>
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

            <div className="fld">
              <label htmlFor="s_email">{t("servants.emailLabel")}</label>
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

            <div className="fld">
              <label htmlFor="s_role">{t("servants.roleLabel")}</label>
              <select
                id="s_role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={saving}
              >
                {SERVICE_ROLES.map((value) => (
                  <option key={value} value={value}>
                    {roleLabel(value)}
                  </option>
                ))}
              </select>
            </div>

            {["خادم", "قائد فصل"].includes(role) && (
              <div className="fld">
                <label htmlFor="s_class">{t("servants.classLabel")}</label>
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
              {saving ? t("servants.saving") : t("servants.save")}
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <Modal title={t("servants.deleteTitle")} subtitle={t("servants.deleteSubtitle")} onClose={() => setDeletingId(null)}>
          <div className="text-center">
            <span className="text-4xl block mb-4">⚠️</span>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(deletingId)}
              >
                {t("servants.deleteConfirm")}
              </button>
              <button
                type="button"
                className="btn ghost flex-1"
                onClick={() => setDeletingId(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <BottomNav />
    </div>
  );
}
