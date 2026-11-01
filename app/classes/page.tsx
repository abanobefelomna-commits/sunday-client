"use client";

import { ChangeEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, ImageIcon, LayoutGrid, LoaderCircle, Pencil, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import { deleteClassImage, getClasses, getImageUrl, getStoredUser, uploadClassImage, type AuthUser, type ClassItem } from "../lib/api";

const GRADE_STYLES = ["#3867d6", "#8e5bbd", "#d27642", "#149273", "#2e8cbf", "#c45866", "#526778"];
const gradeLabel = (grade: string) => grade === "general" ? "الفقرة العامة" : "فصل مدارس الأحد";

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingClassId = useRef<string | null>(null);
  const isAdmin = currentUser?.role === "admin" || currentUser?.servantRole === "مسؤول";

  const loadClasses = async () => {
    try { setLoading(true); setClasses(await getClasses()); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذّر تحميل الفصول"); }
    finally { setLoading(false); }
  };
  useEffect(() => { setCurrentUser(getStoredUser()); void loadClasses(); }, []);
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
  const totalChildren = classes.reduce((sum, item) => sum + (item.childrenCount || 0), 0);

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
    <AppHeader />
    <main className="pg classes-page">
      <input ref={fileInput} onChange={uploadImage} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
      <section className="classes-hero"><div><span className="classes-eyebrow"><LayoutGrid size={15} /> مساحة الخدمة</span><h1>الفصول</h1><p>تابع الفصول والأطفال والخدام من مساحة واحدة واضحة.</p></div><div className="classes-permission"><ShieldCheck size={19} /><span>{isAdmin ? "إدارة جميع الفصول" : "تصفح جميع الفصول"}</span></div></section>
      <section className="classes-summary" aria-label="ملخص الفصول">
        <div><span className="summary-icon blue"><LayoutGrid size={20} /></span><div><strong>{classes.length}</strong><small>فصول متاحة</small></div></div>
        <div><span className="summary-icon gold"><Users size={20} /></span><div><strong>{totalChildren}</strong><small>طفل مسجل</small></div></div>
        <div><span className="summary-icon green"><CheckCircle2 size={20} /></span><div><strong>{classes.filter(item => item.image).length}</strong><small>بصورة تعريفية</small></div></div>
      </section>
      <section className="classes-heading"><div><h2>الفصول الدراسية</h2><p>اختر فصلاً لعرض الأطفال والخدام وتسجيل الحضور.</p></div>{currentUser && <span className="classes-tip"><Camera size={16} /> {isAdmin ? "يمكنك إدارة كل الفصول" : "يمكنك إدارة الفصل المسند إليك فقط"}</span>}</section>
      {loading ? <div className="classes-state"><LoaderCircle className="animate-spin" /> جارٍ تحميل الفصول...</div> : classes.length === 0 ? <div className="classes-state"><ImageIcon size={32} /><strong>لا توجد فصول متاحة لك حالياً</strong><span>تواصل مع المسؤول لتعيينك في فصل.</span></div> : <section className="classes-grid">
        {classes.map((classItem, index) => {
          const color = GRADE_STYLES[index % GRADE_STYLES.length]; const isUploading = uploadingId === classItem.id;
          return <article key={classItem.id} className="class-card" style={{ "--class-color": color } as CSSProperties}>
            <Link href={`/classes/${classItem.id}`} className="class-cover" aria-label={`فتح ${classItem.name}`}>
              {classItem.image ? <img src={getImageUrl(classItem.image)} alt={`صورة ${classItem.name}`} /> : <><span className="class-cover-pattern" /><span className="class-cover-icon">✦</span><span className="class-cover-label">{gradeLabel(classItem.grade)}</span></>}
              <span className="class-count"><Users size={14} /> {classItem.childrenCount || 0}</span>
            </Link>
            <div className="class-content"><div><span className="class-kicker">{gradeLabel(classItem.grade)}</span><Link href={`/classes/${classItem.id}`}><h3>{classItem.name}</h3></Link></div><div className="class-meta"><span>{classItem.childrenCount || 0} طفل</span><i /> <span>{classItem.servantsCount || 0} خدام</span></div><Link href={`/classes/${classItem.id}`} className="class-open">عرض الفصل <span>←</span></Link></div>
            {(isAdmin || currentUser?.classIds?.includes(classItem.id)) && <div className="class-media-actions"><button type="button" onClick={() => chooseImage(classItem.id)} disabled={isUploading} title="تغيير صورة الفصل"><Pencil size={16} /> <span>{isUploading ? "جارٍ الرفع" : "الصورة"}</span></button>{classItem.image && <button type="button" className="remove-image" onClick={() => removeImage(classItem.id)} disabled={isUploading} title="إزالة الصورة"><Trash2 size={16} /></button>}</div>}
          </article>;
        })}
      </section>}
    </main>
    <BottomNav />
  </div>;
}
