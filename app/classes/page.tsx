"use client";

import { ChangeEvent, type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, ImageIcon, LayoutGrid, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { Modal } from "../components/ui";
import { MotionCard, MotionGroup, MotionInView } from "../components/motion";
import { useI18n } from "../lib/app-i18n";
import { canManageClass, createClass, deleteClassImage, getClasses, getImageUrl, getStoredUser, isPrivilegedUser, reorderClasses, restoreDefaultClasses, updateClass, uploadClassImage, type AuthUser, type ClassItem } from "../lib/api";

const GRADE_STYLES = ["#3867d6", "#8e5bbd", "#d27642", "#149273", "#2e8cbf", "#c45866", "#526778"];

export default function ClassesPage() {
  const { t, number } = useI18n();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingClassId = useRef<string | null>(null);
  const isPrivileged = isPrivilegedUser(currentUser);

  const gradeLabel = (grade: string) =>
    grade === "general" ? t("classes.gradeGeneral") : t("classes.gradeService");

  const loadClasses = useCallback(async (includeInactive = false) => {
    await Promise.resolve();
    try {
      setLoading(true);
      setClasses(await getClasses(undefined, includeInactive));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("classes.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    const user = getStoredUser();
    Promise.resolve().then(() => setCurrentUser(user));
    void Promise.resolve().then(() => loadClasses(isPrivilegedUser(user)));
  }, [loadClasses]);
  const openCreate = () => { setEditing(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (item: ClassItem) => { setEditing(item); setName(item.name); setDescription(item.description ?? ""); setDialogOpen(true); };
  const saveClass = async () => {
    if (!name.trim()) { toast.error(t("classes.nameRequired")); return; }
    setSaving(true);
    try {
      if (editing) await updateClass(editing.id, { name: name.trim(), description: description.trim() || null });
      else await createClass({ name: name.trim(), description: description.trim() || null });
      setDialogOpen(false);
      toast.success(editing ? t("classes.updated") : t("classes.created"));
      await loadClasses(isPrivileged);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("classes.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  const toggleActive = async (item: ClassItem) => {
    try {
      await updateClass(item.id, { isActive: item.isActive === false });
      toast.success(item.isActive === false ? t("classes.activated") : t("classes.deactivated"));
      await loadClasses(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : t("classes.toggleFailed")); }
  };
  const moveClass = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= classes.length) return;
    const reordered = [...classes];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setClasses(reordered);
    try {
      await reorderClasses(reordered.map((item) => item.id));
      await loadClasses(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("classes.reorderFailed"));
      await loadClasses(true);
    }
  };
  const restoreDefaults = async () => {
    if (!window.confirm(t("classes.restoreConfirm"))) return;
    setRestoring(true);
    try {
      await restoreDefaultClasses();
      toast.success(t("classes.restored"));
      await loadClasses(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : t("classes.restoreFailed")); }
    finally { setRestoring(false); }
  };
  const chooseImage = (classId: string) => { pendingClassId.current = classId; fileInput.current?.click(); };
  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; const classId = pendingClassId.current; event.target.value = "";
    if (!file || !classId) return;
    setUploadingId(classId);
    try {
      const { image } = await uploadClassImage(classId, file);
      setClasses(items => items.map(item => item.id === classId ? { ...item, image } : item));
      toast.success(t("classes.imageUpdated"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("classes.imageUploadFailed")); }
    finally { setUploadingId(null); pendingClassId.current = null; }
  };
  const removeImage = async (classId: string) => {
    setUploadingId(classId);
    try {
      await deleteClassImage(classId);
      setClasses(items => items.map(item => item.id === classId ? { ...item, image: null } : item));
      toast.success(t("classes.imageRemoved"));
    } catch (error) { toast.error(error instanceof Error ? error.message : t("classes.imageRemoveFailed")); }
    finally { setUploadingId(null); }
  };
  const activeClasses = classes.filter((item) => item.isActive !== false);
  const totalChildren = classes.reduce((sum, item) => sum + (item.childrenCount || 0), 0);

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
    <AppHeader />
    <main className="pg classes-page">
      <input ref={fileInput} onChange={uploadImage} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
      <MotionInView as="section" className="classes-hero">
        <div><span className="classes-eyebrow"><LayoutGrid size={15} /> {t("classes.eyebrow")}</span><h1>{t("classes.title")}</h1><p>{t("classes.subtitle")}</p></div>
        <div className="classes-permission"><ShieldCheck size={19} /><span>{isPrivileged ? t("classes.manageAll") : t("classes.browseAll")}</span></div>
      </MotionInView>
      <MotionInView as="section" className="classes-summary" ariaLabel={t("classes.summaryAria")} delay={0.05}>
        <div><span className="summary-icon blue"><LayoutGrid size={20} /></span><div><strong>{number(activeClasses.length)}</strong><small>{t("classes.active")}</small></div></div>
        <div><span className="summary-icon gold"><Users size={20} /></span><div><strong>{number(totalChildren)}</strong><small>{t("classes.registeredChildren")}</small></div></div>
        <div><span className="summary-icon green"><CheckCircle2 size={20} /></span><div><strong>{number(classes.filter(item => item.image).length)}</strong><small>{t("classes.withImage")}</small></div></div>
      </MotionInView>
      <MotionInView as="section" className="classes-heading" delay={0.08}>
        <div><h2>{t("classes.sectionTitle")}</h2><p>{t("classes.sectionSubtitle")}</p></div>
        <div className="classes-heading-actions">
          {currentUser && <span className="classes-tip"><Camera size={16} /> {isPrivileged ? t("classes.tipManage") : t("classes.tipBrowse")}</span>}
          {isPrivileged && <>
            <button type="button" className="btn ghost sm" onClick={restoreDefaults} disabled={restoring}>{restoring ? t("classes.restoring") : t("classes.restore")}</button>
            <button type="button" className="btn sm" onClick={openCreate}><Plus size={16} /> {t("classes.add")}</button>
          </>}
        </div>
      </MotionInView>
      {loading
        ? <div className="classes-state"><LoaderCircle className="animate-spin" /> {t("classes.loading")}</div>
        : classes.length === 0
          ? <div className="classes-state"><ImageIcon size={32} /><strong>{t("classes.emptyTitle")}</strong><span>{t("classes.emptyBody")}</span></div>
          : <MotionGroup as="section" className="classes-grid" amount={0.05}>
            {classes.map((classItem, index) => {
              const color = GRADE_STYLES[index % GRADE_STYLES.length];
              const isUploading = uploadingId === classItem.id;
              return <MotionCard key={classItem.id} className="class-card" style={{ "--class-color": color } as CSSProperties}>
                <Link href={`/classes/${classItem.id}`} className="class-cover" aria-label={t("classes.openAria", { name: classItem.name })}>
                  {classItem.image
                    ? <img src={getImageUrl(classItem.image)} alt={t("classes.imageAlt", { name: classItem.name })} />
                    : <><span className="class-cover-pattern" /><span className="class-cover-icon">✦</span><span className="class-cover-label">{gradeLabel(classItem.grade)}</span></>}
                  <span className="class-count"><Users size={14} /> {number(classItem.childrenCount || 0)}</span>
                </Link>
                <div className="class-content">
                  <div>
                    <span className="class-kicker">{gradeLabel(classItem.grade)}{classItem.isActive === false ? ` · ${t("classes.inactive")}` : ""}</span>
                    <Link href={`/classes/${classItem.id}`}><h3>{classItem.name}</h3></Link>
                    {classItem.description && <p className="class-description">{classItem.description}</p>}
                  </div>
                  <div className="class-meta"><span>{t("common.childCount", { count: number(classItem.childrenCount || 0) })}</span><i /> <span>{t("common.servantCount", { count: number(classItem.servantsCount || 0) })}</span></div>
                  <Link href={`/classes/${classItem.id}`} className="class-open">{t("classes.open")} <span>←</span></Link>
                  {isPrivileged && <div className="class-admin-actions" aria-label={t("classes.manageAria", { name: classItem.name })}>
                    <button type="button" onClick={() => openEdit(classItem)}><Pencil size={15} /> {t("common.edit")}</button>
                    <button type="button" onClick={() => toggleActive(classItem)}>{classItem.isActive === false ? t("classes.activate") : t("classes.stop")}</button>
                    <button type="button" onClick={() => moveClass(index, -1)} disabled={index === 0} aria-label={t("classes.moveUp", { name: classItem.name })}><ArrowUp size={15} /></button>
                    <button type="button" onClick={() => moveClass(index, 1)} disabled={index === classes.length - 1} aria-label={t("classes.moveDown", { name: classItem.name })}><ArrowDown size={15} /></button>
                  </div>}
                </div>
                {canManageClass(currentUser, classItem.id) && <div className="class-media-actions">
                  <button type="button" onClick={() => chooseImage(classItem.id)} disabled={isUploading} title={t("classes.changeImage")}><Pencil size={16} /> <span>{isUploading ? t("classes.uploading") : t("classes.image")}</span></button>
                  {classItem.image && <button type="button" className="remove-image" onClick={() => removeImage(classItem.id)} disabled={isUploading} title={t("classes.removeImage")}><Trash2 size={16} /></button>}
                </div>}
              </MotionCard>;
            })}
          </MotionGroup>}
      {dialogOpen && <Modal title={editing ? t("classes.editTitle") : t("classes.createTitle")} subtitle={t("classes.modalSubtitle")} onClose={() => !saving && setDialogOpen(false)}>
        <div className="form-grid class-editor">
          <label className="fld full"><span>{t("classes.name")}</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoFocus /></label>
          <label className="fld full"><span>{t("classes.description")}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} /></label>
          <div className="class-editor-actions full">
            <button type="button" className="btn ghost" onClick={() => setDialogOpen(false)} disabled={saving}>{t("common.cancel")}</button>
            <button type="button" className="btn" onClick={saveClass} disabled={saving || !name.trim()}>{saving ? t("common.saving") : t("classes.saveClass")}</button>
          </div>
        </div>
      </Modal>}
    </main>
    <BottomNav />
  </div>;
}
