import type { Metadata } from "next";
import ChurchProvisioningFlow from "./provisioning-flow";

export const metadata: Metadata = {
  title: "Preparing your Church | Sunday School",
  robots: { index: false, follow: false },
};

export default function ChurchProvisioningPage() {
  return <ChurchProvisioningFlow />;
}
