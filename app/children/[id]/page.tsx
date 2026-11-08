"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  Home,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import AppHeader from "../../components/AppHeader";
import BottomNav from "../../components/BottomNav";
import {
  Badge,
  Modal,
  Notice,
  PageHeader,
  ProgressRing,
  SkeletonCards,
  SkeletonRows,
} from "../../components/ui";
import {
  addFollowUpActivity,
  createEducationalProgress,
  createFollowUp,
  createStudentNote,
  deleteEducationalProgress,
  deleteStudentNote,
  getStudentProfile,
  updateChild,
  updateFollowUp,
  type EducationalProgress,
  type FollowUpPriority,
  type FollowUpStatus,
  type StudentProfile,
} from "../../lib/api";
import {
  ageFromBirthDate,
  initials,
  numberAr,
} from "../../lib/format";
import {
  AttendanceTab,
  FollowUpsTab,
  NotesTab,
  OverviewTab,
  ProgressTab,
  VisitationsTab,
} from "./components/tabs";

type TabKey = "overview" | "attendance" | "followups" | "progress" | "notes" | "visitations";

const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "نظرة عامة", icon: <Sparkles className="h-4 w-4" /> },
  { key: "attendance", label: "الحضور", icon: <CalendarDays className="h-4 w-4" /> },
  { key: "followups", label: "المتابعات", icon: <HeartHandshake className="h-4 w-4" /> },
  { key: "progress", label: "التقدم التعليمي", icon: <TrendingUp className="h-4 w-4" /> },
  { key: "notes", label: "الملاحظات", icon: <NotebookPen className="h-4 w-4" /> },
  { key: "visitations", label: "الافتقاد", icon: <Home className="h-4 w-4" /> },
];

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getStudentProfile(id);
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل ملف الطالب");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const student = profile?.student;

  const timelineCounts = useMemo(
    () => ({
      followups: profile?.followUps.filter((item) => item.status === "open" || item.status === "in_progress").length ?? 0,
      notes: profile?.notes.length ?? 0,
      progress: profile?.progress.length ?? 0,
      visitations: profile?.visitations.length ?? 0,
    }),
    [profile],
  );

  const handleAddNote = async (body: string, visibility: "class" | "leaders" | "private") => {
    if (!id) return;
    setBusy(true);
    try {
      await createStudentNote(id, { body, visibility });
      await load();
      showToast("تمت إضافة الملاحظة");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل حفظ الملاحظة");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await deleteStudentNote(id, noteId);
      await load();
      showToast("تم حذف الملاحظة");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل حذف الملاحظة");
    } finally {
      setBusy(false);
    }
  };

  const handleAddProgress = async (input: {
    subject: string;
    level: EducationalProgress["level"];
    score: number | null;
    notes: string;
    assessedAt: string;
  }) => {
    if (!id) return;
    setBusy(true);
    try {
      await createEducationalProgress(id, input);
      await load();
      showToast("تم تسجيل التقدم التعليمي");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل حفظ التقدم التعليمي");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProgress = async (progressId: string) => {
    if (!id) return;
    setBusy(true);
    try {
      await deleteEducationalProgress(id, progressId);
      await load();
      showToast("تم حذف سجل التقدم");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل حذف سجل التقدم");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFollowUp = async (input: {
    reason: string;
    priority: FollowUpPriority;
    servantId: string | null;
    dueDate: string | null;
  }) => {
    if (!id) return;
    setBusy(true);
    try {
      await createFollowUp({ childId: id, ...input });
      await load();
      showToast("تم فتح متابعة جديدة");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل إنشاء المتابعة");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateFollowUp = async (
    followUpId: string,
    input: {
      status?: FollowUpStatus;
      priority?: FollowUpPriority;
      servantId?: string | null;
      dueDate?: string | null;
      resolutionNotes?: string | null;
    },
  ) => {
    setBusy(true);
    try {
      await updateFollowUp(followUpId, input);
      await load();
      showToast("تم تحديث المتابعة");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تحديث المتابعة");
    } finally {
      setBusy(false);
    }
  };

  const handleAddActivity = async (
    followUpId: string,
    input: { type: "note" | "call" | "message" | "visit"; title: string; notes?: string },
  ) => {
    setBusy(true);
    try {
      await addFollowUpActivity(followUpId, input);
      await load();
      showToast("تم تسجيل النشاط");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تسجيل النشاط");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32">
        <AppHeader />
        <main className="pg">
          <div className="skel" style={{ height: 118 }} />
          <SkeletonCards count={4} />
          <div className="surface surface-pad">
            <SkeletonRows rows={5} height={58} />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error || !profile || !student) {
    return (
      <div className="min-h-screen pb-32">
        <AppHeader />
        <main className="pg">
          <Notice tone="danger">{error || "ملف الطالب غير موجود"}</Notice>
          <Link href="/children" className="btn ghost sm" style={{ alignSelf: "flex-start" }}>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            رجوع لقائمة الأطفال
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const age = ageFromBirthDate(student.birthDate);
  const rate = profile.stats.attendanceRate;

  return (
    <div className="min-h-screen pb-32">
      <AppHeader />

      <main className="pg">
        <div className="grow-wrap" style={{ justifyContent: "space-between" }}>
          <Link href="/children" className="link-quiet">
            <ArrowRight className="h-4 w-4" aria-hidden="true" /> كل الأطفال
          </Link>
          <PageHeader
            eyebrow={
              <>
                <UserRound className="h-4 w-4" aria-hidden="true" /> ملف الرحلة
              </>
            }
            title="ملف الطالب"
            subtitle="سجل متكامل للحضور والرعاية والتقدم التعليمي"
            actions={
              <button type="button" className="btn ghost sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> تعديل البيانات
              </button>
            }
          />
        </div>

        <section className="surface surface-pad" aria-label="بطاقة الطالب">
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <span className="avatar-lg" aria-hidden="true">
              {initials(student.name)}
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="grow-wrap" style={{ marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: "clamp(1.3rem, 3vw, 1.7rem)", fontWeight: 800 }}>
                  {student.name}
                </h2>
                <Badge tone={student.gender === "female" ? "violet" : "default"}>
                  {student.gender === "female" ? "بنت" : "ولد"}
                </Badge>
                {age !== null ? <Badge tone="muted">{numberAr(age)} سنة</Badge> : null}
              </div>
              <p style={{ margin: "0 0 8px", color: "var(--mute)", fontSize: ".9rem" }}>
                {student.class?.name || "بدون فصل"}
                {student.assignedServant?.name ? ` · المسؤول: ${student.assignedServant.name}` : ""}
              </p>
              <div className="grow-wrap">
                {student.parentPhone ? (
                  <a className="btn ghost sm" href={`tel:${student.parentPhone}`} dir="ltr">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {student.parentPhone}
                  </a>
                ) : null}
                {student.parentName ? (
                  <Badge tone="muted">ولي الأمر: {student.parentName}</Badge>
                ) : null}
              </div>
            </div>
            <ProgressRing
              value={rate}
              caption="نسبة الحضور"
              color={
                rate === null
                  ? "var(--mute)"
                  : rate >= 85
                    ? "var(--ok)"
                    : rate >= 70
                      ? "var(--warn)"
                      : "var(--danger)"
              }
            />
          </div>

          <div className="divider" style={{ margin: "18px 0" }} />

          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
            <MiniMetric label="جلسات مسجّلة" value={numberAr(profile.stats.totalSessions)} />
            <MiniMetric label="غياب آخر 30 يومًا" value={numberAr(profile.stats.absencesLast30)} />
            <MiniMetric label="متابعات نشطة" value={numberAr(profile.stats.openFollowUps)} />
            <MiniMetric
              label="متوسط التقدم"
              value={profile.stats.progressAverage === null ? "—" : `${profile.stats.progressAverage}`}
            />
          </div>
        </section>

        <div className="tabs2" role="tablist" aria-label="أقسام ملف الطالب">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
            >
              {item.icon}
              {item.label}
              {item.key === "followups" && timelineCounts.followups > 0 ? (
                <span className="count">{numberAr(timelineCounts.followups)}</span>
              ) : null}
              {item.key === "notes" && timelineCounts.notes > 0 ? (
                <span className="count">{numberAr(timelineCounts.notes)}</span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "overview" ? <OverviewTab profile={profile} /> : null}
        {tab === "attendance" ? <AttendanceTab profile={profile} /> : null}
        {tab === "followups" ? (
          <FollowUpsTab
            profile={profile}
            busy={busy}
            onCreate={handleCreateFollowUp}
            onUpdate={handleUpdateFollowUp}
            onAddActivity={handleAddActivity}
          />
        ) : null}
        {tab === "progress" ? (
          <ProgressTab
            profile={profile}
            busy={busy}
            onAdd={handleAddProgress}
            onDelete={handleDeleteProgress}
          />
        ) : null}
        {tab === "notes" ? (
          <NotesTab
            profile={profile}
            busy={busy}
            canWrite={profile.permissions.canWrite}
            onAdd={handleAddNote}
            onDelete={handleDeleteNote}
          />
        ) : null}
        {tab === "visitations" ? <VisitationsTab profile={profile} /> : null}
      </main>

      {editOpen ? (
        <EditModal
          initial={{
            birthDate: student.birthDate?.slice(0, 10) || "",
            parentPhone: student.parentPhone || "",
            parentName: student.parentName || "",
            address: student.address || "",
            notes: student.notes || "",
            phone: student.phone || "",
          }}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await load();
            showToast("تم تحديث بيانات الطفل");
          }}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface" style={{ padding: "12px 14px", boxShadow: "none" }}>
      <small style={{ color: "var(--mute)", fontSize: ".76rem", fontWeight: 700 }}>{label}</small>
      <b style={{ display: "block", fontSize: "1.18rem" }}>{value}</b>
    </div>
  );
}

function EditModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: {
    birthDate: string;
    parentPhone: string;
    parentName: string;
    address: string;
    notes: string;
    phone: string;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const params = useParams<{ id: string }>();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!params?.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateChild(params.id, {
        birthDate: form.birthDate || undefined,
        parentPhone: form.parentPhone,
        parentName: form.parentName,
        address: form.address,
        notes: form.notes,
        phone: form.phone,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="تعديل بيانات الطفل" subtitle="البيانات الأساسية فقط — السجل الرعوي لا يُحذف." onClose={onClose} wide>
      <form onSubmit={submit} className="f">
        <div className="form-grid">
          <div className="fld">
            <label htmlFor="e_birth">تاريخ الميلاد</label>
            <input id="e_birth" type="date" value={form.birthDate} onChange={set("birthDate")} />
          </div>
          <div className="fld">
            <label htmlFor="e_phone">هاتف الطفل</label>
            <input id="e_phone" dir="ltr" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="fld">
            <label htmlFor="e_parent_phone">هاتف ولي الأمر</label>
            <input id="e_parent_phone" dir="ltr" value={form.parentPhone} onChange={set("parentPhone")} />
          </div>
          <div className="fld">
            <label htmlFor="e_parent">اسم ولي الأمر</label>
            <input id="e_parent" value={form.parentName} onChange={set("parentName")} />
          </div>
          <div className="fld full">
            <label htmlFor="e_address">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> العنوان
            </label>
            <input id="e_address" value={form.address} onChange={set("address")} />
          </div>
          <div className="fld full">
            <label htmlFor="e_notes">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> ملاحظات أساسية
            </label>
            <textarea id="e_notes" rows={3} value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        {error ? <p className="msg err">{error}</p> : null}
        <div className="grow-wrap" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
