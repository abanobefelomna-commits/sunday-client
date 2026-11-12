import type { Metadata } from "next";
import JoinChurchFlow from "./join-church-flow";

export const metadata: Metadata = {
  title: "Join a Church | Sunday School",
  description: "Find a church and submit a membership request for its administrator to review.",
};

export default function JoinPage() {
  return <JoinChurchFlow />;
}
