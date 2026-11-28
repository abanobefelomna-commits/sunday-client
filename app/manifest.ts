import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "مدارس الأحد — Sunday School",
    short_name: "مدارس الأحد",
    description:
      "متابعة حضور وغياب الأطفال، الفصول، الخدام والافتقاد — تعمل في المتصفح وكتطبيق مثبّت، مع تسجيل الحضور دون اتصال.",
    lang: "ar",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7fb",
    theme_color: "#1e2a5a",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "الحضور", url: "/attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "الأطفال", url: "/children", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "مشاكل الفصول", url: "/class-problems", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
