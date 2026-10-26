"use client";

import { useEffect, useState, useRef } from "react";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import {
  getNews,
  createNews,
  deleteNews,
  getImageUrl,
  getStoredToken,
  getStoredUser,
  type NewsItem,
  type AuthUser,
} from "../lib/api";

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await getNews(search.trim() || undefined, 1, 50);
      setNews(res.data);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
    setToken(getStoredToken());
    fetchNews();
  }, [search]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    }
  };

  const openCreateModal = () => {
    setTitle("");
    setContent("");
    setIsPinned(false);
    setSelectedFile(null);
    setFilePreview(null);
    setError(null);
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("يرجى كتابة نص الخبر أو الإعلان.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createNews(
        {
          title: title.trim() || undefined,
          content: content.trim(),
          isPinned,
          imageFile: selectedFile,
        },
        token || undefined
      );

      setShowModal(false);
      showToast("تم نشر الخبر بنجاح! 📢");
      fetchNews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل نشر الخبر، حاول مجدداً";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الخبر؟")) return;
    try {
      await deleteNews(id, token || undefined);
      showToast("تم حذف الخبر بنجاح ✓");
      fetchNews();
    } catch {
      showToast("فشل حذف الخبر");
    }
  };

  const handleShare = (item: NewsItem) => {
    const shareText = `${item.title ? item.title + "\n\n" : ""}${item.content}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast("تم نسخ نص الخبر للمشاركة! 📋");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg">
        {/* Header with Title and Add Button */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              الأخبار والإعلانات
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              متابعة جميع الإعلانات والأنشطة والرحلات الخاصة بمدارس الأحد.
            </p>
          </div>

          <button
            type="button"
            className="fab2"
            onClick={openCreateModal}
            aria-label="نشر خبر جديد"
            title="نشر خبر جديد"
          >
            +
          </button>
        </div>

        {/* Search Input */}
        <label className="sb">
          <span aria-hidden="true">🔍</span>
          <input
            placeholder="ابحث في الأخبار والإعلانات…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث في الأخبار"
          />
        </label>

        {/* News Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-400">جارٍ تحميل الأخبار...</div>
          ) : news.length > 0 ? (
            news.map((item) => (
              <article
                key={item.id}
                className={`card relative ${
                  item.isPinned ? "border-amber-400 dark:border-amber-500/50 shadow-md" : ""
                }`}
              >
                {/* Pinned Tag */}
                {item.isPinned && (
                  <span className="absolute top-4 left-4 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1">
                    📌 إعلان مُثبت
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
                  <span>
                    {new Date(item.createdAt).toLocaleDateString("ar-EG", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  {(item.authorName || item.author?.name) && (
                    <>
                      <span>·</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {item.authorName || item.author?.name}
                      </span>
                    </>
                  )}
                </div>

                {item.title && (
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {item.title}
                  </h3>
                )}

                <p className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                  {item.content}
                </p>

                {/* Optional Image */}
                {item.image && (
                  <div
                    className="mb-4 rounded-2xl overflow-hidden cursor-pointer max-h-72 bg-slate-100 dark:bg-slate-800"
                    onClick={() => setLightboxImage(getImageUrl(item.image))}
                  >
                    <img
                      src={getImageUrl(item.image)}
                      alt={item.title || "صورة الخبر"}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  </div>
                )}

                {/* Action Buttons: Share & Delete */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleShare(item)}
                    className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 font-medium transition"
                  >
                    <span>📋</span>
                    <span>مشاركة الخبر</span>
                  </button>

                  {token && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition"
                    >
                      <span>🗑</span>
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <div className="card text-center py-12">
              <span className="text-4xl block mb-2">📰</span>
              <b className="block text-slate-800 dark:text-slate-100 text-lg">
                لا توجد أخبار منشورة حالياً
              </b>
              <p className="text-slate-500 text-sm mt-1 mb-4">
                كن أول من ينشر إعلاناً أو خبراً لأسرة الخدمة.
              </p>
              <button type="button" className="btn" onClick={openCreateModal}>
                نشر خبر جديد
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Publish News Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                نشر خبر أو إعلان جديد
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

            <form onSubmit={handleCreate} className="f text-right space-y-4">
              <div>
                <label htmlFor="n_title">عنوان الخبر (اختياري)</label>
                <input
                  id="n_title"
                  type="text"
                  placeholder="مثال: موعد رحلة عيد القيامة"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div>
                <label htmlFor="n_content">نص الإعلان أو التفاصيل</label>
                <textarea
                  id="n_content"
                  rows={4}
                  required
                  placeholder="اكتب تفاصيل الخبر هنا..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Pin checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  disabled={saving}
                />
                <span className="text-sm font-semibold">تثبيت الإعلان في أعلى الصفحة 📌</span>
              </label>

              {/* Image upload */}
              <div>
                <label htmlFor="n_img">صورة مرفقة (اختياري)</label>
                <input
                  ref={fileInputRef}
                  id="n_img"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={saving}
                />

                {filePreview && (
                  <div className="mt-2 relative rounded-xl overflow-hidden max-h-40 border border-slate-200 dark:border-slate-800">
                    <img src={filePreview} alt="معاينة" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-2 left-2 bg-red-600 text-white rounded-full p-1 text-xs"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="msg err">{error}</p>}

              <button
                type="submit"
                className="btn big w-full mt-4 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? "جارٍ النشر..." : "نشر الإعلان الآن"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="صورة مكبرة"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && <div className="toast">{toastMsg}</div>}

      <BottomNav />
    </div>
  );
}
