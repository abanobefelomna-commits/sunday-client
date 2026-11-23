"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  KeyRound,
  Church,
  LogOut,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Ban,
  Sparkles,
  Users,
  Search,
} from "lucide-react";
import { toast } from "sonner";

interface CreationCode {
  id: string;
  codePrefix: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  status: "active" | "revoked" | "expired" | "depleted";
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ChurchItem {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  status: string;
  isLifetimeFree: boolean;
  creationCodeId: string | null;
  creatorName: string | null;
  creatorEmail: string | null;
  creationCodePrefix: string | null;
  createdAt: string;
}

interface ChurchJoinCode {
  churchId: string;
  churchName: string;
  churchSlug: string;
  churchStatus: string;
  code: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  isExpired: boolean;
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<CreationCode[]>([]);
  const [churches, setChurches] = useState<ChurchItem[]>([]);
  const [churchJoinCodes, setChurchJoinCodes] = useState<ChurchJoinCode[]>([]);
  const [activeTab, setActiveTab] = useState<"codes" | "churches" | "join-codes">("codes");

  // Create Code Modal / State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newCodeNote, setNewCodeNote] = useState("");
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1);
  const [newCodeExpireDays, setNewCodeExpireDays] = useState(30);

  // Freshly generated code to display once
  const [revealedCode, setRevealedCode] = useState<{
    code: string;
    prefix: string;
    note: string | null;
  } | null>(null);
  const [revealedJoinCode, setRevealedJoinCode] = useState<{
    churchName: string;
    code: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Search & Filter
  const [codeSearch, setCodeSearch] = useState("");
  const [churchSearch, setChurchSearch] = useState("");

  async function loadData() {
    try {
      const [authRes, codesRes, churchesRes, joinCodesRes] = await Promise.all([
        fetch("/api/super-admin/me"),
        fetch("/api/super-admin/codes"),
        fetch("/api/super-admin/churches"),
        fetch("/api/super-admin/church-join-codes"),
      ]);

      if (!authRes.ok) {
        router.replace("/super-admin/access");
        return;
      }

      if (codesRes.ok) {
        const codesData = await codesRes.json();
        setCodes(codesData.data || []);
      }

      if (churchesRes.ok) {
        const churchesData = await churchesRes.json();
        setChurches(churchesData.data || []);
      }

      if (joinCodesRes.ok) {
        const joinCodesData = await joinCodesRes.json();
        setChurchJoinCodes(joinCodesData.data || []);
      } else {
        throw new Error("تعذر تحميل رموز انضمام الكنائس");
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      toast.error("حدث خطأ أثناء تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // The loader awaits every fetch before touching state, so this is not a
    // synchronous setState inside an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/super-admin/logout", { method: "POST" });
      toast.success("تم تسجيل الخروج بنجاح");
      router.replace("/super-admin/access");
    } catch {
      router.replace("/super-admin/access");
    }
  }

  async function handleGenerateCode(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch("/api/super-admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: newCodeNote.trim() || undefined,
          maxUses: Number(newCodeMaxUses) || 1,
          expiresInDays: Number(newCodeExpireDays) || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "فشل توليد الرمز");
      }

      setRevealedCode({
        code: data.code,
        prefix: data.codePrefix,
        note: data.note,
      });

      toast.success("تم توليد الرمز بنجاح! احفظه الآن.");
      setShowGenerateModal(false);
      setNewCodeNote("");
      setNewCodeMaxUses(1);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل توليد الرمز";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevokeCode(id: string) {
    if (!window.confirm("هل أنت متأكد من رغبتك في إلغاء هذا الرمز فوراً؟")) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/codes/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل إلغاء الرمز");

      toast.success("تم إلغاء الرمز بنجاح.");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إلغاء الرمز";
      toast.error(msg);
    }
  }

  async function handleRotateCode(id: string) {
    if (
      !window.confirm(
        "سيتم إلغاء هذا الرمز وإصدار رمز بديل جديد له نفس الخصائص. هل تريد المتابعة؟"
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل تدوير الرمز");

      setRevealedCode({
        code: data.code,
        prefix: data.codePrefix,
        note: data.note,
      });

      toast.success("تم تدوير الرمز بنجاح!");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تدوير الرمز";
      toast.error(msg);
    }
  }

  async function handleRotateJoinCode(church: ChurchJoinCode) {
    if (!window.confirm(`سيتم إلغاء الرمز الحالي لكنيسة "${church.churchName}" فوراً وإصدار رمز جديد. أي شخص يستخدم الرمز القديم لن يستطيع بدء تسجيل جديد. هل تريد المتابعة؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/church-join-codes/${church.churchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate" }),
      });
      const data = await res.json() as { code?: unknown; message?: string };
      if (!res.ok || typeof data.code !== "string") {
        throw new Error(data.message || "تعذر تدوير رمز الانضمام");
      }

      setRevealedJoinCode({ churchName: church.churchName, code: data.code });
      toast.success(`تم تدوير رمز الانضمام لكنيسة ${church.churchName}`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر تدوير رمز الانضمام");
    }
  }

  async function handleRevokeJoinCode(church: ChurchJoinCode) {
    if (!window.confirm(`إلغاء الرمز سيمنع بدء تسجيلات جديدة لكنيسة "${church.churchName}" باستخدامه. لن يؤثر ذلك على الحسابات التي أُنشئت سابقاً. هل تريد المتابعة؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/church-join-codes/${church.churchId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "تعذر إلغاء رمز الانضمام");

      toast.success(`تم إلغاء رمز الانضمام لكنيسة ${church.churchName}`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "تعذر إلغاء رمز الانضمام");
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("تم نسخ الرمز إلى الحافظة!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("تعذر نسخ الرمز إلى الحافظة");
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-slate-50 dark:bg-slate-950 p-4"
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">جاري تحميل لوحة تحكم المدير العام...</p>
        </div>
      </div>
    );
  }

  const filteredCodes = codes.filter(
    (c) =>
      c.codePrefix.toLowerCase().includes(codeSearch.toLowerCase()) ||
      (c.note && c.note.toLowerCase().includes(codeSearch.toLowerCase()))
  );

  const filteredChurches = churches.filter(
    (c) =>
      c.name.toLowerCase().includes(churchSearch.toLowerCase()) ||
      c.slug.toLowerCase().includes(churchSearch.toLowerCase()) ||
      (c.creatorName && c.creatorName.toLowerCase().includes(churchSearch.toLowerCase())) ||
      (c.creatorEmail && c.creatorEmail.toLowerCase().includes(churchSearch.toLowerCase()))
  );

  const activeCodesCount = codes.filter((c) => c.status === "active").length;
  const depletedCodesCount = codes.filter((c) => c.status === "depleted").length;

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 font-sans"
      dir="rtl"
    >
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                لوحة تحكم المدير العام
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                إدارة أذونات ورموز إنشاء الكنائس
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              title="تحديث البيانات"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200/60 dark:border-red-900/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Freshly Generated / Rotated Code Alert Banner */}
        {revealedCode && (
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border-2 border-emerald-500/30 dark:border-emerald-500/20 shadow-xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-sm mb-1">
                  <Sparkles className="w-5 h-5" />
                  <span>رمز إنشاء الكنيسة الجديد (يظهر مرة واحدة فقط)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {revealedCode.note ? `المخصص لـ: ${revealedCode.note} — ` : ""}
                  احفظ هذا الرمز وشاركه مع مسؤول الكنيسة المعتمد. لن يظهر الرمز كاملاً مرة أخرى
                  لدواعي الأمان.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <code className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/50 text-emerald-800 dark:text-emerald-300 font-mono text-base sm:text-lg font-black tracking-wider select-all" dir="ltr">
                  {revealedCode.code}
                </code>
                <button
                  onClick={() => copyToClipboard(revealedCode.code)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "تم النسخ" : "نسخ"}</span>
                </button>
                <button
                  onClick={() => setRevealedCode(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2"
                >
                  إخفاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                الرموز الفعّالة
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {activeCodesCount}
              </h3>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Church className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                إجمالي الكنائس بالمنصة
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {churches.length}
              </h3>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                الرموز المستنفدة
              </p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {depletedCodesCount}
              </h3>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab("codes")}
            className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "codes"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>رموز إنشاء الكنائس ({codes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("churches")}
            className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "churches"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <Church className="w-4 h-4" />
            <span>إدارة إنشاء الكنائس ({churches.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("join-codes")}
            className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "join-codes"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>رموز انضمام الكنائس ({churchJoinCodes.length})</span>
          </button>
        </div>

        {/* TAB 1: Church Creation Codes */}
        {activeTab === "codes" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث في الرموز أو الملاحظات..."
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  className="w-full pl-4 pr-9 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                onClick={() => setShowGenerateModal(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>توليد رمز إنشاء كنيسة جديد</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 text-start font-bold">بادئة الرمز</th>
                      <th className="py-3.5 px-4 text-start font-bold">الوصف / المستلم</th>
                      <th className="py-3.5 px-4 text-start font-bold">الاستخدام</th>
                      <th className="py-3.5 px-4 text-start font-bold">الحالة</th>
                      <th className="py-3.5 px-4 text-start font-bold">تاريخ الإنشاء</th>
                      <th className="py-3.5 px-4 text-start font-bold">تاريخ الانتهاء</th>
                      <th className="py-3.5 px-4 text-end font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredCodes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          لا توجد رموز إنشاء مسجلة حالياً
                        </td>
                      </tr>
                    ) : (
                      filteredCodes.map((code) => {
                        const isExpired =
                          code.status === "active" &&
                          code.expiresAt &&
                          new Date(code.expiresAt) <= new Date();
                        const displayStatus = isExpired ? "expired" : code.status;

                        return (
                          <tr
                            key={code.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                              {code.codePrefix}••••
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                              {code.note || "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {code.usedCount}
                              </span>{" "}
                              / {code.maxUses}
                            </td>
                            <td className="py-3.5 px-4">
                              {displayStatus === "active" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                  نشط
                                </span>
                              )}
                              {displayStatus === "depleted" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  مستنفد
                                </span>
                              )}
                              {displayStatus === "revoked" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800/60">
                                  ملغي
                                </span>
                              )}
                              {displayStatus === "expired" && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                                  منتهي الصلاحية
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {new Date(code.createdAt).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500">
                              {code.expiresAt
                                ? new Date(code.expiresAt).toLocaleDateString("ar-EG")
                                : "لا ينتهي"}
                            </td>
                            <td className="py-3.5 px-4 text-end space-x-1 space-x-reverse">
                              {code.status === "active" && !isExpired && (
                                <>
                                  <button
                                    onClick={() => handleRotateCode(code.id)}
                                    title="تدوير الرمز (إلغاء الحالي وتوليد جديد)"
                                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRevokeCode(code.id)}
                                    title="إلغاء الرمز"
                                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Churches & Creators */}
        {activeTab === "churches" && (
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث باسم الكنيسة أو الرابط أو منشئها..."
                value={churchSearch}
                onChange={(e) => setChurchSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 text-start font-bold">اسم الكنيسة</th>
                      <th className="py-3.5 px-4 text-start font-bold">الرابط المختصر</th>
                      <th className="py-3.5 px-4 text-start font-bold">المدينة</th>
                      <th className="py-3.5 px-4 text-start font-bold">المسؤول / المنشئ</th>
                      <th className="py-3.5 px-4 text-start font-bold">رمز الإنشاء المرتبط</th>
                      <th className="py-3.5 px-4 text-start font-bold">الحالة</th>
                      <th className="py-3.5 px-4 text-start font-bold">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredChurches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          لا توجد كنائس مطابقة للبحث
                        </td>
                      </tr>
                    ) : (
                      filteredChurches.map((church) => (
                        <tr
                          key={church.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                            {church.name}
                            {church.isLifetimeFree && (
                              <span className="mr-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                الكنيسة التأسيسية
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400" dir="ltr">
                            {church.slug}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                            {church.city || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            {church.creatorName ? (
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {church.creatorName}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {church.creatorEmail}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">كنيسة أساسية / يدوي</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {church.creationCodePrefix ? (
                              <code className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold" dir="ltr">
                                {church.creationCodePrefix}••••
                              </code>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {church.status === "active" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                مفعّلة
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                {church.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(church.createdAt).toLocaleDateString("ar-EG")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "join-codes" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              هذه رموز انضمام للخدام إلى كنيسة موجودة، وليست رموز إنشاء كنيسة جديدة. إلغاء الرمز يمنع التسجيلات الجديدة به ولا يغيّر حسابات المستخدمين الحاليين. رمز الانضمام لا يمنح صلاحية إدارية.
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-4 text-start font-bold">الكنيسة</th>
                      <th className="py-3.5 px-4 text-start font-bold">رمز الانضمام</th>
                      <th className="py-3.5 px-4 text-start font-bold">حالة الكنيسة</th>
                      <th className="py-3.5 px-4 text-start font-bold">الصلاحية</th>
                      <th className="py-3.5 px-4 text-end font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {churchJoinCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          لا توجد كنائس مسجلة
                        </td>
                      </tr>
                    ) : churchJoinCodes.map((church) => (
                      <tr key={church.churchId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{church.churchName}</div>
                          <div className="font-mono text-[11px] text-slate-500" dir="ltr">{church.churchSlug}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {church.code ? (
                            <div className="flex items-center gap-2">
                              <code className="font-mono font-bold tracking-wider" dir="ltr">{church.code}</code>
                              {church.isExpired && <span className="text-amber-600 dark:text-amber-400">منتهي</span>}
                              <button
                                type="button"
                                onClick={() => {
                                  if (church.code) void copyToClipboard(church.code);
                                }}
                                title="نسخ رمز الانضمام"
                                aria-label={`نسخ رمز انضمام ${church.churchName}`}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : <span className="text-slate-400">لا يوجد رمز فعّال</span>}
                        </td>
                        <td className="py-3.5 px-4">{church.churchStatus}</td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {church.expiresAt ? new Date(church.expiresAt).toLocaleDateString("ar-EG") : "لا ينتهي"}
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void handleRotateJoinCode(church)}
                              title="إلغاء الرمز الحالي وإصدار بديل"
                              aria-label={`تدوير رمز انضمام ${church.churchName}`}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            {church.code && (
                              <button
                                type="button"
                                onClick={() => void handleRevokeJoinCode(church)}
                                title="إلغاء رمز الانضمام"
                                aria-label={`إلغاء رمز انضمام ${church.churchName}`}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:bg-red-950/40"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Generate Code Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  توليد رمز إنشاء كنيسة جديد
                </h3>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateCode} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1.5">
                  الوصف / الكنيسة المستلمة (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: كنيسة الشهيد مارجرجس بالمنيا"
                  value={newCodeNote}
                  onChange={(e) => setNewCodeNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5">
                    عدد مرات الاستخدام
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newCodeMaxUses}
                    onChange={(e) => setNewCodeMaxUses(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-center"
                  />
                  <small className="text-[10px] text-slate-400">الافتراضي: ١ كنيسة واحدة</small>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1.5">
                    الصلاحية (بالأيام)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={newCodeExpireDays}
                    onChange={(e) => setNewCodeExpireDays(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans text-center"
                  />
                  <small className="text-[10px] text-slate-400">الافتراضي: ٣٠ يوماً</small>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {generating ? "جاري التوليد..." : "توليد الرمز"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {revealedJoinCode && (
        <div className="fixed bottom-5 left-5 right-5 sm:left-auto sm:right-8 z-40 max-w-xl rounded-2xl border border-emerald-500/30 bg-white p-4 shadow-2xl dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">رمز انضمام جديد — {revealedJoinCode.churchName}</p>
              <p className="text-[11px] text-slate-500">أصبح الرمز السابق غير صالح؛ شارك الرمز الجديد مع الخدام.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="font-mono font-black tracking-wider" dir="ltr">{revealedJoinCode.code}</code>
              <button
                type="button"
                onClick={() => void copyToClipboard(revealedJoinCode.code)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                نسخ
              </button>
              <button type="button" onClick={() => setRevealedJoinCode(null)} aria-label="إخفاء الرمز">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
