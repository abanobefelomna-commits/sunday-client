"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Baby,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  SkeletonRows,
} from "../components/ui";
import {
  createChild,
  deleteChild,
  getChild,
  getChildren,
  getClass,
  getClasses,
  updateChild,
  type ChildItem,
  type ClassItem,
  type ServantItem,
} from "../lib/api";
import { formatDate, initials, numberAr } from "../lib/format";

const PAGE_SIZE = 24;

export default function ChildrenPage() {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formParentName, setFormParentName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formGender, setFormGender] = useState<"male" | "female">("male");
  const [formServantId, setFormServantId] = useState("");
  const [classServants, setClassServants] = useState<ServantItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const [resCh, resCl] = await Promise.all([
        getChildren({
          search: debouncedSearch || undefined,
          classId: selectedClassId !== "all" ? selectedClassId : undefined,
          page,
          limit: PAGE_SIZE,
        }),
        getClasses(),
      ]);
      setChildren(resCh.data);
      setTotal(resCh.total);
      setClasses(resCl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات الأطفال");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedClassId, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!formClassId) return;
    let cancelled = false;
    getClass(formClassId)
      .then((detail) => {
        if (cancelled) return;
        setClassServants((detail.servants ?? []) as ServantItem[]);
      })
      .catch(() => {
        if (!cancelled) setClassServants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [formClassId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const classCount = classes.length;
  const withServant = useMemo(
    () => children.filter((child) => child.assignedServantId).length,
    [children],
  );

  const openAddModal = () => {
    setEditingChild(null);
    setFormName("");
    setFormClassId(selectedClassId !== "all" ? selectedClassId : classes[0]?.id || "");
    setFormBirthDate("");
    setFormPhone("");
    setFormParentName("");
    setFormAddress("");
    setFormNotes("");
    setFormGender("male");
    setFormServantId("");
    setClassServants([]);
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = async (child: ChildItem) => {
    setEditingChild(child);
    setFormName(child.name);
    setFormClassId(child.classId || "");
    setFormBirthDate(child.birthDate ? child.birthDate.slice(0, 10) : "");
    setFormPhone(child.parentPhone || child.phone || "");
    setFormParentName(child.parentName || "");
    setFormAddress(child.address || "");
    setFormNotes(child.notes || "");
    setFormGender(child.gender === "female" ? "female" : "male");
    setFormServantId(child.assignedServantId || "");
    if (!child.classId) setClassServants([]);
    setFormError(null);
    setShowModal(true);
    try {
      const fresh = await getChild(child.id);
      setFormServantId(fresh.assignedServantId || "");
    } catch {
      // keep the list value
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formName.trim()) {
      setFormError("يرجى إدخال اسم الطفل.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: formName.trim(),
        classId: formClassId || "",
        birthDate: formBirthDate || undefined,
        parentPhone: formPhone.trim() || "",
        parentName: formParentName.trim() || "",
        address: formAddress.trim() || "",
        notes: formNotes.trim() || "",
        gender: formGender,
        assignedServantId: formServantId || null,
      };

      if (editingChild) {
        await updateChild(editingChild.id, payload);
      } else {
        await createChild({
          ...payload,
          classId: formClassId || undefined,
          assignedServantId: formServantId || undefined,
        });
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "تعذر حفظ بيانات الطفل");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حذف الطفل");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <PageHeader
          eyebrow={
            <>
              <Baby className="h-4 w-4" aria-hidden="true" /> دليل الرحلة
            </>
          }
          title="الأطفال"
          subtitle="كل طفل ملف رعوي كامل: الحضور، الافتقاد، المتابعة والتقدم التعليمي."
          actions={
            <button type="button" className="btn" onClick={openAddModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              إضافة طفل
            </button>
          }
        />

        <div className="kpi-grid" aria-label="ملخص الأطفال">
          <MiniStat label="إجمالي الأطفال" value={numberAr(total)} hint="حسب البحث الحالي" />
          <MiniStat label="الفصول" value={numberAr(classCount)} hint="فصول الخدمة المتاحة" />
          <MiniStat label="لديهم خادم مسؤول" value={numberAr(withServant)} hint="في الصفحة الحالية" />
          <MiniStat label="الصفحة" value={`${numberAr(page)} / ${numberAr(totalPages)}`} hint={`${PAGE_SIZE} طفل لكل صفحة`} />
        </div>

        <div className="surface surface-pad stack">
          <div className="filters">
            <label className="sb" style={{ flex: 1, minWidth: 220 }}>
              <Search className="h-4 w-4 opacity-50" aria-hidden="true" />
              <input
                placeholder="ابحث بالاسم أو هاتف ولي الأمر…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="بحث في الأطفال"
              />
            </label>
            <label className="fld" style={{ minWidth: 170 }}>
              <span className="sr-only">تصفية بالفصل</span>
              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setPage(1);
                }}
                aria-label="تصفية بالفصل"
              >
                <option value="all">كل الفصول</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <div className="notice danger">{error}</div> : null}

          {loading ? (
            <SkeletonRows rows={5} height={72} />
          ) : children.length === 0 ? (
            <EmptyState
              icon="🧒"
              title={debouncedSearch ? "لا نتائج مطابقة" : "لا يوجد أطفال مسجلين"}
              description={
                debouncedSearch
                  ? "جرّب اسمًا مختلفًا أو أزل تصفية الفصل."
                  : "ابدأ بإضافة أول طفل؛ سيُنشأ له ملف رحلة كامل تلقائيًا."
              }
              action={
                <button type="button" className="btn sm" onClick={openAddModal}>
                  إضافة طفل
                </button>
              }
            />
          ) : (
            <div className="list-stack">
              {children.map((child) => (
                <article key={child.id} className="listrow">
                  <Link
                    href={`/children/${child.id}`}
                    style={{ display: "contents" }}
                    aria-label={`فتح ملف ${child.name}`}
                  >
                    <span
                      className="avatar-md"
                      style={{ ["--a-color" as string]: gradeColor(child.class?.grade) }}
                      aria-hidden="true"
                    >
                      {initials(child.name)}
                    </span>
                    <span className="grow">
                      <b>{child.name}</b>
                      <small>
                        {child.class?.name || "بدون فصل"} ·{" "}
                        {child.assignedServant?.name
                          ? `المسؤول: ${child.assignedServant.name}`
                          : "لا يوجد خادم مسؤول"}
                      </small>
                      <small dir="ltr" style={{ textAlign: "start" }}>
                        {child.parentPhone || "لا يوجد هاتف"}
                      </small>
                    </span>
                  </Link>

                  <div className="grow-wrap" style={{ justifyContent: "flex-end" }}>
                    <Badge
                      tone={
                        child.gender === "female" ? "violet" : "default"
                      }
                    >
                      {child.gender === "female" ? "بنت" : "ولد"}
                    </Badge>
                    {child.birthDate ? (
                      <Badge tone="muted">{formatDate(child.birthDate)}</Badge>
                    ) : null}
                    <button
                      type="button"
                      className="ib"
                      onClick={() => openEditModal(child)}
                      aria-label={`تعديل بيانات ${child.name}`}
                      title="تعديل"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="ib"
                      style={{ color: "var(--danger)" }}
                      onClick={() => setDeletingId(child.id)}
                      aria-label={`حذف ${child.name}`}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="grow-wrap" style={{ justifyContent: "center" }} aria-label="ترقيم الصفحات">
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                السابق
              </button>
              <span style={{ fontSize: ".85rem", color: "var(--mute)" }}>
                صفحة {numberAr(page)} من {numberAr(totalPages)}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
              >
                التالي
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      </main>

      {showModal ? (
        <Modal
          title={editingChild ? "تعديل بيانات الطفل" : "إضافة طفل جديد"}
          subtitle="البيانات الأساسية تُنشئ ملف الرحلة تلقائيًا."
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={handleSave} className="f">
            <div className="form-grid">
              <div className="fld full">
                <label htmlFor="c_name">اسم الطفل الكامل *</label>
                <input
                  id="c_name"
                  required
                  placeholder="مثال: يوسف هاني فهمي"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld">
                <label htmlFor="c_class">الفصل</label>
                <select
                  id="c_class"
                  value={formClassId}
                  onChange={(event) => {
                    setFormClassId(event.target.value);
                    setFormServantId("");
                    if (!event.target.value) setClassServants([]);
                  }}
                  disabled={saving}
                >
                  <option value="">بدون فصل محدد</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="fld">
                <label htmlFor="c_servant">الخادم المسؤول</label>
                <select
                  id="c_servant"
                  value={formServantId}
                  onChange={(event) => setFormServantId(event.target.value)}
                  disabled={saving || classServants.length === 0}
                >
                  <option value="">بدون تعيين</option>
                  {classServants.map((servant) => (
                    <option key={servant.id} value={servant.id}>
                      {servant.name} — {servant.role}
                    </option>
                  ))}
                </select>
                {formClassId && classServants.length === 0 ? (
                  <small style={{ fontWeight: 500 }}>لا يوجد خدام معيّنون على هذا الفصل.</small>
                ) : null}
              </div>

              <div className="fld">
                <label htmlFor="c_birth">تاريخ الميلاد</label>
                <input
                  id="c_birth"
                  type="date"
                  value={formBirthDate}
                  onChange={(event) => setFormBirthDate(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld">
                <label htmlFor="c_gender">النوع</label>
                <select
                  id="c_gender"
                  value={formGender}
                  onChange={(event) => setFormGender(event.target.value as "male" | "female")}
                  disabled={saving}
                >
                  <option value="male">ولد</option>
                  <option value="female">بنت</option>
                </select>
              </div>

              <div className="fld">
                <label htmlFor="c_phone">هاتف ولي الأمر</label>
                <input
                  id="c_phone"
                  type="tel"
                  dir="ltr"
                  placeholder="01XXXXXXXXX"
                  value={formPhone}
                  onChange={(event) => setFormPhone(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld">
                <label htmlFor="c_parent">اسم ولي الأمر</label>
                <input
                  id="c_parent"
                  value={formParentName}
                  onChange={(event) => setFormParentName(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld full">
                <label htmlFor="c_address">العنوان</label>
                <input
                  id="c_address"
                  value={formAddress}
                  onChange={(event) => setFormAddress(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld full">
                <label htmlFor="c_notes">ملاحظات أساسية</label>
                <textarea
                  id="c_notes"
                  rows={2}
                  value={formNotes}
                  onChange={(event) => setFormNotes(event.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {formError ? <p className="msg err">{formError}</p> : null}

            <div className="grow-wrap" style={{ marginTop: 18, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                إلغاء
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ البيانات"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deletingId ? (
        <Modal
          title="تأكيد حذف الطفل"
          subtitle="الحذف يحافظ على سجل الحضور والافتقاد والمتابعات للأرشيف."
          onClose={() => setDeletingId(null)}
        >
          <div className="notice warn" style={{ marginBottom: 16 }}>
            <Trash2 className="h-5 w-5 flex-none" aria-hidden="true" />
            سيتم إخفاء الطفل من القوائم النشطة، لكن سجله التاريخي يبقى محفوظًا للمراجعة الرعوية.
          </div>
          <div className="grow-wrap" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => setDeletingId(null)} disabled={deleting}>
              إلغاء
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "var(--danger)" }}
              onClick={() => handleDelete(deletingId)}
              disabled={deleting}
            >
              {deleting ? "جارٍ الحذف…" : "حذف من القوائم"}
            </button>
          </div>
        </Modal>
      ) : null}

      <BottomNav />
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className="kpi-icon" aria-hidden="true">
          <UserRound className="h-4 w-4" />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function gradeColor(grade?: string): string {
  switch (grade) {
    case "first":
      return "#e8a317";
    case "second":
      return "#3b6ff5";
    case "third":
      return "#2fa36b";
    case "fourth":
      return "#d64545";
    case "fifth":
      return "#8b5cf6";
    case "sixth":
      return "#0ea5b7";
    default:
      return "#7c5cd6";
  }
}
