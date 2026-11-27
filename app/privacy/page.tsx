import type { Metadata } from "next";
import PolicyNotice from "../components/public-site/PolicyNotice";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | مدارس الأحد",
  description: "سياسة خصوصية منصة مدارس الأحد: البيانات التي نجمعها، وكيف نستخدمها، ومن يمكنه الوصول إليها، وأمان البيانات والاحتفاظ بها.",
};

export default function PrivacyPage() {
  return <PolicyNotice kind="privacy" />;
}
