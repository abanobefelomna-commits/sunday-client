import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import BibleWidget from "./components/BibleWidget";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "مدارس الأحد — مكان لأولادنا في المرحلة الابتدائية",
  description: "خدمة مدارس الأحد، نتعلّم فيها كلمة الله ونكبر معًا في المحبة. متابعة الحضور والغياب، الفصول، الأطفال، والافتقاد.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        {children}
        <BibleWidget />
      </body>
    </html>
  );
}
