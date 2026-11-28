import type { Metadata } from "next";
import OfflineFallbackClient from "./OfflineFallbackClient";

export const metadata: Metadata = {
  title: "دون اتصال — مدارس الأحد",
  robots: { index: false },
};

export default function OfflinePage() {
  return <OfflineFallbackClient />;
}
