import type { Metadata } from "next";
import RegisterChurchFlow from "./register-church-flow";

export const metadata: Metadata = {
  title: "Register a Church | Sunday School",
  description: "Start a church workspace registration request.",
};

export default function RegisterChurchPage() {
  return <RegisterChurchFlow />;
}
