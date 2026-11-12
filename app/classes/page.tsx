"use client";

import { ChangeEvent, type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, ImageIcon, LayoutGrid, LoaderCircle, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { Modal } from "../components/ui";
import { MotionCard } from "../components/motion";
import { canManageClass, createClass, deleteClassImage, getClasses, getImageUrl, getStoredUser, isPrivilegedUser, reorderClasses, restoreDefaultClasses, updateClass, uploadClassImage, type AuthUser, type ClassItem } from "../lib/api";

const GRADE_STYLES = ["#3867d6", "#8e5bbd", "#d27642", "#149273", "#2e8cbf", "#c45866", "#526778"];
const gradeLabel = (grade: string) => grade === "general" ? "المجموعة العامة" : "فصل الخدمة";

export default function ClassesPage() {
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

  const loadClasses = useCallback(async (includeInactive = false) => {
    await Promise.resolve();
    try { setLoading(true); setClasses(await getClasses(undefined, includeInactive)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذّر تحميل الفصول"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const user = getStoredUser();
    Promise.resolve().then(() => setCurrentUser(user));
    void Promise.resolve().then(() => loadClasses(isPrivilegedUser(user)));
  }, [loadClasses]);
  const openCreate = () => { setEditing(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (item: ClassItem) => { setEditing(item); setName(item.name); setDescription(item.description ?? ""); setDialogOpen(true); };
  const saveClass = async () => {
    if (!name.trim()) { toast.error("اكتب اسم الفصل"); return; }
    setSaving(true);
    try {
      if (editing) await updateClass(editing.id, { name: name.trim(), description: description.trim() || null });
      else await createClass({ name: name.trim(), description: description.trim() || null });
      setDialogOpen(false);
      toast.success(editing ? "تم تحديث الفصل" : "تم إنشاء الفصل");
      await loadClasses(isPrivileged);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ الفصل");
    } finally { setSaving(false); }
  };
  const toggleActive = async (item: ClassItem) => {
    try {
      await updateClass(item.id, { isActive: item.isActive === false });
      toast.success(item.isActive === false ? "تم تفعيل الفصل" : "تم إيقاف الفصل");
      await loadClasses(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذّر تحديث حالة الفصل"); }
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
      toast.error(error instanceof Error ? error.message : "تعذّر تحديث ترتيب الفصول");
      await loadClasses(true);
    }
  };
  const restoreDefaults = async () => {
    if (!window.confirm("استعادة أسماء الفصول الافتراضية؟ ستبقى كل السجلات محفوظة.")) return;
    setRestoring(true);
    try {
      await restoreDefaultClasses();
      toast.success("تمت استعادة الفصول الافتراضية");
      await loadClasses(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذّرت استعادة الفصول"); }
    finally { setRestoring(false); }
  };
  const chooseImage = (classId: string) => { pendingClassId.current = classId; fileInput.current?.click(); };
  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; const classId = pendingClassId.current; event.target.value = "";
    if (!file || !classId) return;
    setUploadingId(classId);
    try { const { image } = await uploadClassImage(classId, file); setClasses(items => items.map(item => item.id === classId ? { ...item, image } : item)); toast.success("تم تحديث صورة الفصل"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذّر رفع الصورة"); }
    finally { setUploadingId(null); pendingClassId.current = null; }
  };
  const removeImage = async (classId: string) => {
    setUploadingId(classId);
    try { await deleteClassImage(classId); setClasses(items => items.map(item => item.id === classId ? { ...item, image: null } : item)); toast.success("تمت إزالة صورة الفصل"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذّرت إزالة الصورة"); }
    finally { setUploadingId(null); }
  };
  const activeClasses = classes.filter((item) => item.isActive !== false);
  const totalChildren = classes.reduce((sum, item) => sum + (item.childrenCount || 0), 0);

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
    <AppHeader />
    <main className="pg classes-page">
      <input ref={fileInput} onChange={uploadImage} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
      <section className="classes-hero"><div><span className="classes-eyebrow"><LayoutGrid size={15} /> مساحة الخدمة</span><h1>الفصول</h1><p>تابع الفصول والأطفال والخدام من مساحة واحدة واضحة.</p></div><div className="classes-permission"><ShieldCheck size={19} /><span>{isPrivileged ? "إدارة جميع الفصول" : "تصفح جميع الفصول"}</span></div></section>
      <section className="classes-summary" aria-label="ملخص الفصول">
        <div><span className="summary-icon blue"><LayoutGrid size={20} /></span><div><strong>{activeClasses.length}</strong><small>فصول نشطة</small></div></div>
        <div><span className="summary-icon gold"><Users size={20} /></span><div><strong>{totalChildren}</strong><small>طفل مسجل</small></div></div>
        <div><span className="summary-icon green"><CheckCircle2 size={20} /></span><div><strong>{classes.filter(item => item.image).length}</strong><small>بصورة تعريفية</small></div></div>
      </section>
      <section className="classes-heading"><div><h2>الفصول الدراسية</h2><p>اختر فصلاً لعرض الأطفال والخدام وتسجيل الحضور.</p></div><div className="classes-heading-actions">{currentUser && <span className="classes-tip"><Camera size={16} /> {isPrivileged ? "يمكنك إدارة كل الفصول" : "يمكنك تصفح كل الفصول — التعديل لفصلك فقط"}</span>}{isPrivileged && <><button type="button" className="btn ghost sm" onClick={restoreDefaults} disabled={restoring}>{restoring ? "جارٍ الاستعادة" : "استعادة الافتراضي"}</button><button type="button" className="btn sm" onClick={openCreate}><Plus size={16} /> إضافة فصل</button></>}</div></section>
      {loading ? <div className="classes-state"><LoaderCircle className="animate-spin" /> جارٍ تحميل الفصول...</div> : classes.length === 0 ? <div className="classes-state"><ImageIcon size={32} /><strong>لا توجد فصول متاحة لك حالياً</strong><span>تواصل مع المسؤول لتعيينك في فصل.</span></div> : <section className="classes-grid">
        {classes.map((classItem, index) => {
          const color = GRADE_STYLES[index % GRADE_STYLES.length]; const isUploading = uploadingId === classItem.id;
          return <MotionCard key={classItem.id} className="class-card" style={{ "--class-color": color } as CSSProperties}>
            <Link href={`/classes/${classItem.id}`} className="class-cover" aria-label={`فتح ${classItem.name}`}>
              {classItem.image ? <img src={getImageUrl(classItem.image)} alt={`صورة ${classItem.name}`} /> : <><span className="class-cover-pattern" /><span className="class-cover-icon">✦</span><span className="class-cover-label">{gradeLabel(classItem.grade)}</span></>}
              <span className="class-count"><Users size={14} /> {classItem.childrenCount || 0}</span>
            </Link>
            <div className="class-content"><div><span className="class-kicker">{gradeLabel(classItem.grade)}{classItem.isActive === false ? " · متوقف" : ""}</span><Link href={`/classes/${classItem.id}`}><h3>{classItem.name}</h3></Link>{classItem.description && <p className="class-description">{classItem.description}</p>}</div><div className="class-meta"><span>{classItem.childrenCount || 0} طفل</span><i /> <span>{classItem.servantsCount || 0} خدام</span></div><Link href={`/classes/${classItem.id}`} className="class-open">عرض الفصل <span>←</span></Link>
              {isPrivileged && <div className="class-admin-actions" aria-label={`إدارة ${classItem.name}`}><button type="button" onClick={() => openEdit(classItem)}><Pencil size={15} /> تعديل</button><button type="button" onClick={() => toggleActive(classItem)}>{classItem.isActive === false ? "تفعيل" : "إيقاف"}</button><button type="button" onClick={() => moveClass(index, -1)} disabled={index === 0} aria-label={`تقديم ${classItem.name}`}><ArrowUp size={15} /></button><button type="button" onClick={() => moveClass(index, 1)} disabled={index === classes.length - 1} aria-label={`تأخير ${classItem.name}`}><ArrowDown size={15} /></button></div>}
            </div>
            {canManageClass(currentUser, classItem.id) && <div className="class-media-actions"><button type="button" onClick={() => chooseImage(classItem.id)} disabled={isUploading} title="تغيير صورة الفصل"><Pencil size={16} /> <span>{isUploading ? "جارٍ الرفع" : "الصورة"}</span></button>{classItem.image && <button type="button" className="remove-image" onClick={() => removeImage(classItem.id)} disabled={isUploading} title="إزالة الصورة"><Trash2 size={16} /></button>}</div>}
          </MotionCard>;
        })}
      </section>}
      {dialogOpen && <Modal title={editing ? "تعديل الفصل" : "إضافة فصل"} subtitle="تظهر التغييرات داخل هذه الكنيسة فقط." onClose={() => !saving && setDialogOpen(false)}>
        <div className="form-grid class-editor">
          <label className="fld full"><span>اسم الفصل</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoFocus /></label>
          <label className="fld full"><span>الوصف</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} /></label>
          <div className="class-editor-actions full"><button type="button" className="btn ghost" onClick={() => setDialogOpen(false)} disabled={saving}>إلغاء</button><button type="button" className="btn" onClick={saveClass} disabled={saving || !name.trim()}>{saving ? "جارٍ الحفظ" : "حفظ الفصل"}</button></div>
        </div>
      </Modal>}
    </main>
    <BottomNav />
  </div>;
}
