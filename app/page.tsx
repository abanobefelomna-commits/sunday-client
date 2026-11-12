import type { Metadata } from "next";
import PublicLanding from "./components/public-site/PublicLanding";

export const metadata: Metadata = {
  title: "مدارس الأحد — مساحة عصرية لخدمة الكنيسة",
  description: "نظّم مدارس الأحد والأطفال والفصول والحضور والخدام والمتابعة في مساحة واحدة.",
  openGraph: {
    title: "مدارس الأحد — مساحة عصرية لخدمة الكنيسة",
    description: "مساحة حديثة لتنظيم خدمة مدارس الأحد ومتابعتها.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "مدارس الأحد — مساحة عصرية لخدمة الكنيسة",
    description: "مساحة حديثة لتنظيم خدمة مدارس الأحد ومتابعتها.",
  },
};

export default function LandingPage() {
  return <PublicLanding />;
}
