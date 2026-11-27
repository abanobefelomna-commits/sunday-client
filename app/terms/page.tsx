import type { Metadata } from "next";
import PolicyNotice from "../components/public-site/PolicyNotice";

export const metadata: Metadata = {
  title: "شروط الاستخدام | مدارس الأحد",
  description: "شروط استخدام منصة مدارس الأحد: الاستخدام المقبول، مسؤوليات المستخدم ومسؤول الكنيسة، حماية بيانات الأطفال، وأمان الحساب.",
};

export default function TermsPage() {
  return <PolicyNotice kind="terms" />;
}
