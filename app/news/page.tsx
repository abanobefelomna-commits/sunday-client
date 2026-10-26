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
import { toast } from "sonner";
import {
  ThumbsUp,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  Pin,
  Trash2,
  Globe,
  Sparkles,
  MoreHorizontal,
  X,
  Camera,
} from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Social interactions state (local / session)
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, string[]>>({});
  const [newCommentText, setNewCommentText] = useState("");

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
      if (file.size > 5 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً، الحد الأقصى ٥ ميجابايت");
        return;
      }
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const openCreateModal = (pin = false) => {
    setTitle("");
    setContent("");
    setIsPinned(pin);
    setSelectedFile(null);
    setFilePreview(null);
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("يرجى كتابة نص الخبر أو الإعلان.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("جارٍ نشر الخبر وصورته...");

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
      toast.success("تم نشر الإعلان بنجاح في مجتمع الخدمة! 📢", { id: toastId });
      fetchNews();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل نشر الخبر، حاول مجدداً";
      toast.error(msg, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المنشور؟")) return;
    const toastId = toast.loading("جارٍ حذف المنشور...");
    try {
      await deleteNews(id, token || undefined);
      toast.success("تم حذف المنشور بنجاح ✓", { id: toastId });
      fetchNews();
    } catch {
      toast.error("فشل حذف المنشور", { id: toastId });
    }
  };

  const toggleLike = (postId: string) => {
    setLikedPosts((prev) => {
      const isCurrentlyLiked = !!prev[postId];
      const nextState = !isCurrentlyLiked;
      if (nextState) {
        toast.success("أعجبك المنشور 👍", { duration: 1500 });
      }
      return { ...prev, [postId]: nextState };
    });
  };

  const handleShare = (item: NewsItem) => {
    const shareText = `${item.title ? item.title + "\n\n" : ""}${item.content}\n\n— خدمة مدارس الأحد`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      toast.success("تم نسخ محتوى الخبر للمشاركة! 📋");
    } else {
      toast.info("تم تجهيز الخبر للمشاركة");
    }
  };

  const handleAddComment = (postId: string) => {
    if (!newCommentText.trim()) return;
    const author = user?.name || "خادم";
    const fullComment = `${author}: ${newCommentText.trim()}`;
    setCommentsMap((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), fullComment],
    }));
    setNewCommentText("");
    toast.success("تمت إضافة تعليقك ✓");
  };

  const timeAgo = (dateStr: string) => {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} ي`;
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-32">
      <AppHeader />

      <main className="pg max-w-2xl mx-auto px-3 sm:px-4">
        {/* Header Title Banner */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>الأخبار ومجتمع الخدمة</span>
              <Sparkles className="w-5 h-5 text-amber-500" />
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
              الإعلانات، الصور، والأنشطة المشتركة لأسرة مدارس الأحد.
            </p>
          </div>

          <button
            type="button"
            className="btn sm flex items-center gap-1.5 shadow-md"
            onClick={() => openCreateModal()}
          >
            <span>+ منشور جديد</span>
          </button>
        </div>

        {/* Facebook-style Composer Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 overflow-hidden flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
              {user?.avatar ? (
                <img
                  src={getImageUrl(user.avatar)}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.name?.charAt(0) || "✝"}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => openCreateModal()}
              className="flex-1 text-right bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 text-sm px-4 py-2.5 rounded-full transition cursor-pointer"
            >
              ما الجديد في خدمتك اليوم يا {user?.name?.split(" ")[0] || "خادم"}؟
            </button>
          </div>

          <div className="flex items-center justify-around pt-3">
            <button
              type="button"
              onClick={() => {
                openCreateModal();
                setTimeout(() => fileInputRef.current?.click(), 100);
              }}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 px-3 py-1.5 rounded-xl transition"
            >
              <Camera className="w-4 h-4 text-emerald-500" />
              <span>صورة / إعلان</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateModal(true)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 px-3 py-1.5 rounded-xl transition"
            >
              <Pin className="w-4 h-4 text-amber-500" />
              <span>إعلان مثبت</span>
            </button>

            <button
              type="button"
              onClick={() => openCreateModal()}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-3 py-1.5 rounded-xl transition"
            >
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>نشاط أو رحلة</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <input
            placeholder="🔍 ابحث في الأخبار والإعلانات بالكلمات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Feed of Posts (Facebook Card Style) */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center text-slate-400 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-2"></div>
              <p>جارٍ تحميل أخبار الخدمة...</p>
            </div>
          ) : news.length > 0 ? (
            news.map((item) => {
              const authorName = item.authorName || item.author?.name || "مدارس الأحد";
              const authorRole = item.authorRole || item.author?.role || "خادم";
              const authorAvatar = item.author?.avatar;
              const authorInitial = authorName.replace(/^أ\. /, "").charAt(0) || "✝";
              const imageUrl = item.image ? getImageUrl(item.image) : null;
              const isLiked = !!likedPosts[item.id];
              const likesCount = (isLiked ? 1 : 0) + (item.isPinned ? 5 : 2);
              const postComments = commentsMap[item.id] || [];

              return (
                <article
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition duration-200 overflow-hidden"
                >
                  {/* Post Header */}
                  <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                    <div className="relative">
                      {authorAvatar ? (
                        <img
                          src={getImageUrl(authorAvatar)}
                          alt={authorName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                          {authorInitial}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <b className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate hover:underline cursor-pointer">
                          {authorName}
                        </b>
                        {item.isPinned && (
                          <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0 border border-amber-300 dark:border-amber-800">
                            <Pin className="w-3 h-3 fill-current" />
                            <span>مثبت</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {authorRole === "admin" ? "مسؤول" : "أسرة الخدمة"}
                        </span>
                        <span>•</span>
                        <span>{timeAgo(item.createdAt)}</span>
                        <span>•</span>
                        <Globe className="w-3 h-3 inline-block" />
                      </div>
                    </div>

                    {/* Actions Menu (Delete) */}
                    {token && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition"
                        title="حذف المنشور"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="px-4 py-2">
                    {item.title && (
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                        {item.title}
                      </h3>
                    )}
                    <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-normal">
                      {item.content}
                    </p>
                  </div>

                  {/* Post Media (Facebook Style Full Width Image) */}
                  {imageUrl && (
                    <div
                      className="mt-2 bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden max-h-[520px] group"
                      onClick={() => setLightboxImage(imageUrl)}
                    >
                      <img
                        src={imageUrl}
                        alt={item.title || "صورة الخبر"}
                        className="w-full h-auto object-cover max-h-[520px] group-hover:scale-[1.01] transition duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Reaction Summary Bar */}
                  <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1 rtl:space-x-reverse">
                        <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] shadow-sm">
                          👍
                        </span>
                        <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-white text-[9px] shadow-sm">
                          ❤️
                        </span>
                      </div>
                      <span className="font-semibold">{likesCount} تفاعل</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>{postComments.length > 0 ? `${postComments.length} تعليق` : "لا توجد تعليقات بعد"}</span>
                      <span>•</span>
                      <span>مشاركة</span>
                    </div>
                  </div>

                  {/* Post Interactive Buttons Row */}
                  <div className="flex items-center divide-x divide-slate-100 dark:divide-slate-800/80 rtl:divide-x-reverse py-1">
                    <button
                      type="button"
                      onClick={() => toggleLike(item.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold transition rounded-lg mx-1 ${
                        isLiked
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/30"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
                      <span>{isLiked ? "أعجبني" : "إعجاب"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveCommentPostId(activeCommentPostId === item.id ? null : item.id)
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition rounded-lg mx-1"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>تعليق</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShare(item)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition rounded-lg mx-1"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>مشاركة</span>
                    </button>
                  </div>

                  {/* Comments Box (Toggleable) */}
                  {activeCommentPostId === item.id && (
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                      {postComments.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {postComments.map((c, i) => (
                            <div
                              key={i}
                              className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300"
                            >
                              {c}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="اكتب تعليقاً على هذا المنشور..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddComment(item.id);
                          }}
                          className="flex-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(item.id)}
                          className="btn sm"
                        >
                          إرسال
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
              <span className="text-5xl block mb-3">📰</span>
              <b className="block text-slate-800 dark:text-slate-100 text-lg mb-1">
                لا توجد أخبار منشورة حالياً
              </b>
              <p className="text-slate-500 text-sm mb-5">
                كن أول من ينشر إعلاناً أو يشارك صورة لنشاط في مدارس الأحد.
              </p>
              <button
                type="button"
                className="btn big"
                onClick={() => openCreateModal()}
              >
                + إنشاء أول منشور الآن
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Publish News Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                إنشاء منشور جديد
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setShowModal(false)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Author info inside modal */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0) || "✝"}
              </div>
              <div>
                <b className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {user?.name || "خادم المسيح"}
                </b>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  <span>مرئي لجميع خدام ومجتمع الخدمة</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-right">
              <div>
                <label htmlFor="n_title" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  عنوان رئيسي (اختياري)
                </label>
                <input
                  id="n_title"
                  type="text"
                  placeholder="مثال: موعد رحلة ومهرجان الكرازة"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="n_content" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  نص المنشور والتفاصيل
                </label>
                <textarea
                  id="n_content"
                  rows={4}
                  required
                  placeholder="بماذا تفكر؟ اكتب تفاصيل الإعلان أو التهنئة أو الخبر هنا..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={saving}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Pin option */}
              <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  disabled={saving}
                />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <Pin className="w-3.5 h-3.5 fill-current" />
                  <span>تثبيت هذا الإعلان في أعلى صفحة الأخبار 📌</span>
                </span>
              </label>

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  صورة المنشور (مثل فيسبوك)
                </label>
                <div
                  className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center cursor-pointer hover:border-blue-500 transition bg-slate-50 dark:bg-slate-800/40"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    id="n_img"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={saving}
                    className="hidden"
                  />

                  {filePreview ? (
                    <div className="relative">
                      <img
                        src={filePreview}
                        alt="معاينة الصورة"
                        className="w-full max-h-52 object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        className="absolute top-2 left-2 bg-red-600 text-white rounded-full p-1.5 shadow-lg hover:bg-red-700 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFilePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-5 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        اضغط هنا لإرفاق صورة للمنشور
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        JPG, PNG, WEBP · تدعم حتى 5 ميجابايت
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="btn big w-full mt-4 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? "جارٍ نشر المنشور..." : "نشر الآن 📢"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 text-white hover:text-slate-300 transition z-10 p-2"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxImage}
            alt="معاينة الصورة بالحجم الكامل"
            className="max-w-full max-h-[92vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
