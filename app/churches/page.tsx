import type { Metadata } from "next";
import ChurchDirectoryFlow from "./church-directory-flow";

export const metadata: Metadata = {
  title: "Find a Church | Sunday School",
  description: "Explore churches that chose to publish their public details.",
};

export default function ChurchesPage() {
  return <ChurchDirectoryFlow />;
}
