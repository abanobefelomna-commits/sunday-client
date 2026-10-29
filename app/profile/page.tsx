"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getStoredUser,
  getCurrentUser,
  updateUserProfile,
  uploadUserAvatar,
  deleteUserAvatar,
  changeUserPassword,
  getImageUrl,
  type AuthUser,
} from "../lib/api";
import { toast } from "sonner";
import { Camera, Trash2, Save, KeyRound, User, Phone, Mail, GraduationCap, ShieldCheck } from "lucide-react";

const GRADES = [
  { value: "first", label: "سنة أولى ابتدائي" },
  { value: "second", label: "سنة ثانية ابتدائي" },
  { value: "third", label: "سنة ثالثة ابتدائي" },
  { value: "fourth", label: "سنة رابعة ابتدائي" },
  { value: "fifth", label: "سنة خامسة ابتدائي" },
  { value: "sixth", label: "سنة سادسة ابتدائي" },
  { value: "general", label: "فقرة عامة" },
];

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("first");
  const [avatar, setAvatar] = useState<string | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const stored = getStoredUser();
        if (stored) {
          setUser(stored);
          setName(stored.name || "");
          setPhone(stored.phone || "");
          setEmail(stored.email || "");
          setGrade(stored.grades?.[0] || "first");
          setAvatar(stored.avatar || null);
        }

        const fresh = await getCurrentUser();
        if (fresh) {
          setUser(fresh);
          setName(fresh.name || "");
          setPhone(fresh.phone || "");
          setEmail(fresh.email || "");
          setGrade(fresh.grades?.[0] || "first");
          setAvatar(fresh.avatar || null);
        }
      } catch {
        // fallback to stored user
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً، الحد الأقصى ٥ ميجابايت");
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading("جارٍ رفع صورتك الشخصية...");

    try {
      const res = await uploadUserAvatar(user.id, file);
      setAvatar(res.avatar);
      setUser((prev) => (prev ? { ...prev, avatar: res.avatar } : null));
      toast.success("تم تحديث صورتك الشخصية بنجاح 🖼️", { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل رفع الصورة";
      toast.error(msg, { id: toastId });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id) return;
    if (!confirm("هل أنت متأكد من حذف الصورة الشخصية؟")) return;

    setUploadingAvatar(true);
    const toastId = toast.loading("جارٍ حذف الصورة...");

    try {
      await deleteUserAvatar(user.id);
      setAvatar(null);
      setUser((prev) => (prev ? { ...prev, avatar: null } : null));
      toast.success("تم حذف الصورة الشخصية بنجاح ✓", { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل حذف الصورة";
      toast.error(msg, { id: toastId });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("يرجى ملء الاسم ورقم الهاتف.");
      return;
    }

    setSavingProfile(true);
    const toastId = toast.loading("جارٍ حفظ التغييرات...");

    try {
      const updated = await updateUserProfile(user.id, {
        name: name.trim(),
        phone: phone.trim(),
        grades: [grade],
      });

      setUser(updated);
      toast.success("تم حفظ بياناتك بنجاح ومزامنة الفصل! ✓", { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر حفظ التعديلات";
      toast.error(msg, { id: toastId });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!oldPassword || !newPassword) {
      toast.error("يرجى كتابة كلمة المرور الحالية والجديدة.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("كلمة المرور الجديدة يجب أن تكون ٨ أحرف على الأقل.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقين.");
      return;
    }

    setSavingPassword(true);
    const toastId = toast.loading("جارٍ تحديث كلمة المرور...");

    try {
      await changeUserPassword(user.id, {
        oldPassword,
        newPassword,
      });

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("تم تغيير كلمة المرور بنجاح 🔒", { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تغيير كلمة المرور";
      toast.error(msg, { id: toastId });
    } finally {
      setSavingPassword(false);
    }
  };

  const initial = user?.name ? user.name.replace(/^أ\. /, "").trim().charAt(0) : "✝";
  const gradeLabel = GRADES.find((g) => g.value === grade)?.label || "سنة أولى ابتدائي";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg max-w-2xl mx-auto">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            ← العودة للوحة التحكم
          </Link>
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-3 py-1 rounded-full">
            الملف الشخصي (بروفايل الخادم)
          </span>
        </div>

        {/* Profile Card Header with Avatar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 left-0 h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 opacity-90"></div>

          <div className="relative pt-8 flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar Circle with Upload Trigger */}
            <div className="relative group">
              <div className="w-28 h-28 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-xl flex items-center justify-center">
                {avatar ? (
                  <img
                    src={getImageUrl(avatar)}
                    alt={user?.name || "صورة الخادم"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
                    {initial}
                  </span>
                )}
              </div>

              {/* Upload Camera Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-1 left-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2.5 shadow-lg transition transform hover:scale-110 flex items-center justify-center cursor-pointer"
                title="تغيير صورتك الشخصية"
                aria-label="تغيير صورتك الشخصية"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarSelect}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* User Meta Summary */}
            <div className="text-center sm:text-right flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {user?.name || "خادم المسيح"}
                </h1>
                <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {user?.role === "admin" ? "مسؤول الخدمة" : "خادم معتمد"}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1">
                <GraduationCap className="w-4 h-4 text-blue-500" />
                <span>{gradeLabel}</span>
              </p>
            </div>

            {/* Remove Avatar Button */}
            {avatar && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                title="إزالة الصورة والرجوع للحرف الأولي"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إزالة الصورة</span>
              </button>
            )}
          </div>
        </div>

        {/* Edit Profile Info Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              البيانات الشخصية والخدمة
            </h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-right">
            <div>
              <label htmlFor="p-name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الاسم بالكامل
              </label>
              <div className="relative">
                <input
                  id="p-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: أ. مينا سامي"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="p-phone" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الموبايل
                </label>
                <div className="relative">
                  <input
                    id="p-phone"
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01000000000"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="p-grade" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المرحلة / الفصل الذي تخدم به
                </label>
                <select
                  id="p-grade"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="p-email" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                البريد الإلكتروني (المعرف الأساسي للحساب)
              </label>
              <input
                id="p-email"
                type="email"
                disabled
                dir="ltr"
                value={email}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                لتغيير البريد الإلكتروني، يرجى التواصل مع أمين أو مسؤول الخدمة.
              </span>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="btn big w-full mt-4 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? "جارٍ حفظ البيانات..." : "حفظ التغييرات"}</span>
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              أمان الحساب وكلمة المرور
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 text-right">
            <div>
              <label htmlFor="old-pass" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                كلمة المرور الحالية
              </label>
              <input
                id="old-pass"
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-pass" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور الجديدة (٨ أحرف فأكثر)
                </label>
                <input
                  id="new-pass"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="conf-pass" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  id="conf-pass"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="btn big ghost w-full mt-4 flex items-center justify-center gap-2 border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            >
              <KeyRound className="w-4 h-4" />
              <span>{savingPassword ? "جارٍ التحديث..." : "تحديث كلمة المرور"}</span>
            </button>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
