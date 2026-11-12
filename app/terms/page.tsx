import type { Metadata } from "next";
import PolicyNotice from "../components/public-site/PolicyNotice";

export const metadata: Metadata = { title: "Terms | Sunday School", robots: { index: false, follow: false } };

export default function TermsPage() {
  return <PolicyNotice kind="terms" />;
}
