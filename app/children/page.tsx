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
  canManageClass,
  createChild,
  deleteChild,
  getChild,
  getChildren,
  getClass,
  getClasses,
  getStoredUser,
  isPrivilegedUser,
  updateChild,
  type AuthUser,
  type ChildItem,
  type ClassItem,
  type ServantItem,
} from "../lib/api";
import { formatDateFor, initials } from "../lib/format";
import { useI18n } from "../lib/app-i18n";

const PAGE_SIZE = 24;

export default function ChildrenPage() {
  const { t, locale, number } = useI18n();
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

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
    setCurrentUser(getStoredUser());
  }, []);

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
      setError(err instanceof Error ? err.message : t("children.loadError"));
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
  const writableClasses = useMemo(
    () => classes.filter((item) => canManageClass(currentUser, item.id)),
    [classes, currentUser],
  );
  const canAddChild =
    isPrivilegedUser(currentUser) || writableClasses.length > 0;
  const canWriteChild = (child: ChildItem) =>
    canManageClass(currentUser, child.classId);

  const openAddModal = () => {
    setEditingChild(null);
    setFormName("");
    const preferredClass = writableClasses.find((item) => item.id === selectedClassId);
    setFormClassId(preferredClass?.id || writableClasses[0]?.id || "");
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
      setFormError(t("children.nameRequired"));
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
      setFormError(err instanceof Error ? err.message : t("children.saveError"));
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
      setError(err instanceof Error ? err.message : t("children.deleteError"));
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
              <Baby className="h-4 w-4" aria-hidden="true" /> {t("children.eyebrow")}
            </>
          }
          title={t("nav.children")}
          subtitle={t("children.subtitle")}
          actions={
            canAddChild ? (
              <button type="button" className="btn" onClick={openAddModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("children.add")}
              </button>
            ) : null
          }
        />

        <div className="kpi-grid" aria-label={t("children.summaryAria")}>
          <MiniStat label={t("children.total")} value={number(total)} hint={t("children.totalHint")} />
          <MiniStat label={t("children.classes")} value={number(classCount)} hint={t("children.classesHint")} />
          <MiniStat label={t("children.withServant")} value={number(withServant)} hint={t("children.withServantHint")} />
          <MiniStat label={t("children.pageLabel")} value={`${number(page)} / ${number(totalPages)}`} hint={t("children.pageHint", { count: number(PAGE_SIZE) })} />
        </div>

        <div className="surface surface-pad stack">
          <div className="filters">
            <label className="sb" style={{ flex: 1, minWidth: 220 }}>
              <Search className="h-4 w-4 opacity-50" aria-hidden="true" />
              <input
                placeholder={t("children.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={t("children.searchAria")}
              />
            </label>
            <label className="fld" style={{ minWidth: 170 }}>
              <span className="sr-only">{t("children.filterClassAria")}</span>
              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setPage(1);
                }}
                aria-label={t("children.filterClassAria")}
              >
                <option value="all">{t("common.allClasses")}</option>
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
              title={debouncedSearch ? t("children.noResults") : t("children.noChildren")}
              description={
                debouncedSearch
                  ? t("children.noResultsHint")
                  : t("children.noChildrenHint")
              }
              action={
                canAddChild ? (
                  <button type="button" className="btn sm" onClick={openAddModal}>
                    {t("children.add")}
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="list-stack">
              {children.map((child) => (
                <article key={child.id} className="listrow listrow-person">
                  <Link
                    href={`/children/${child.id}`}
                    className="listrow-main"
                    aria-label={t("children.openAria", { name: child.name })}
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
                        {child.class?.name || t("common.noClass")} ·{" "}
                        {child.assignedServant?.name
                          ? t("children.responsibleName", { name: child.assignedServant.name })
                          : t("children.noServant")}
                      </small>
                      <small>
                        <bdi dir="ltr">{child.parentPhone || t("common.noPhone")}</bdi>
                      </small>
                    </span>
                  </Link>

                  <div className="listrow-actions">
                    <Badge
                      tone={
                        child.gender === "female" ? "violet" : "default"
                      }
                    >
                      {child.gender === "female" ? t("children.female") : t("children.male")}
                    </Badge>
                    {child.birthDate ? (
                      <Badge tone="muted">{formatDateFor(child.birthDate, locale)}</Badge>
                    ) : null}
                    {canWriteChild(child) ? (
                      <>
                        <button
                          type="button"
                          className="ib"
                          onClick={() => openEditModal(child)}
                          aria-label={t("children.editAria", { name: child.name })}
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="ib"
                          style={{ color: "var(--danger)" }}
                          onClick={() => setDeletingId(child.id)}
                          aria-label={t("children.deleteAria", { name: child.name })}
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <Badge tone="muted">{t("common.viewOnly")}</Badge>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {totalPages > 1 ? (
            <nav className="grow-wrap" style={{ justifyContent: "center" }} aria-label={t("common.paginationAria")}>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                {t("common.prev")}
              </button>
              <span style={{ fontSize: ".85rem", color: "var(--mute)" }}>
                {t("common.pageOf", { page: number(page), total: number(totalPages) })}
              </span>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
              >
                {t("common.next")}
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </div>
      </main>

      {showModal ? (
        <Modal
          title={editingChild ? t("children.editTitle") : t("children.addTitle")}
          subtitle={t("children.modalSubtitle")}
          onClose={() => setShowModal(false)}
          wide
        >
          <form onSubmit={handleSave} className="f">
            <div className="form-grid">
              <div className="fld full">
                <label htmlFor="c_name">{t("children.nameLabel")}</label>
                <input
                  id="c_name"
                  required
                  placeholder={t("children.namePlaceholder")}
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld">
                <label htmlFor="c_class">{t("children.classLabel")}</label>
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
                  <option value="">{t("children.noClassOption")}</option>
                  {writableClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.grade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="fld">
                <label htmlFor="c_servant">{t("children.servantLabel")}</label>
                <select
                  id="c_servant"
                  value={formServantId}
                  onChange={(event) => setFormServantId(event.target.value)}
                  disabled={saving || classServants.length === 0}
                >
                  <option value="">{t("children.noServantOption")}</option>
                  {classServants.map((servant) => (
                    <option key={servant.id} value={servant.id}>
                      {servant.name} — {servant.role}
                    </option>
                  ))}
                </select>
                {formClassId && classServants.length === 0 ? (
                  <small style={{ fontWeight: 500 }}>{t("children.noClassServants")}</small>
                ) : null}
              </div>

              <div className="fld">
                <label htmlFor="c_birth">{t("children.birthDate")}</label>
                <input
                  id="c_birth"
                  type="date"
                  value={formBirthDate}
                  onChange={(event) => setFormBirthDate(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld">
                <label htmlFor="c_gender">{t("common.gender")}</label>
                <select
                  id="c_gender"
                  value={formGender}
                  onChange={(event) => setFormGender(event.target.value as "male" | "female")}
                  disabled={saving}
                >
                  <option value="male">{t("children.male")}</option>
                  <option value="female">{t("children.female")}</option>
                </select>
              </div>

              <div className="fld">
                <label htmlFor="c_phone">{t("children.parentPhone")}</label>
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
                <label htmlFor="c_parent">{t("children.parentName")}</label>
                <input
                  id="c_parent"
                  value={formParentName}
                  onChange={(event) => setFormParentName(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld full">
                <label htmlFor="c_address">{t("common.address")}</label>
                <input
                  id="c_address"
                  value={formAddress}
                  onChange={(event) => setFormAddress(event.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="fld full">
                <label htmlFor="c_notes">{t("common.notes")}</label>
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
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? t("common.savingShort") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deletingId ? (
        <Modal
          title={t("children.deleteTitle")}
          subtitle={t("children.deleteSubtitle")}
          onClose={() => setDeletingId(null)}
        >
          <div className="notice warn" style={{ marginBottom: 16 }}>
            <Trash2 className="h-5 w-5 flex-none" aria-hidden="true" />
            {t("children.deleteNotice")}
          </div>
          <div className="grow-wrap" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn ghost" onClick={() => setDeletingId(null)} disabled={deleting}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "var(--danger)" }}
              onClick={() => handleDelete(deletingId)}
              disabled={deleting}
            >
              {deleting ? t("common.deleting") : t("children.deleteConfirm")}
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
