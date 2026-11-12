import type { Metadata } from "next";
import PolicyNotice from "../components/public-site/PolicyNotice";

export const metadata: Metadata = { title: "Privacy | Sunday School", robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return <PolicyNotice kind="privacy" />;
}
