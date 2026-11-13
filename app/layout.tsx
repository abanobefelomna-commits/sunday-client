// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { cookies } from "next/headers";
import "./globals.css";
import "./components/public-site/public-site-global.css";
import "./components/public-site/public-site.css";
import BibleWidget from "./components/BibleWidget";
import { LocaleProvider } from "./components/LocaleProvider";
import { Toaster } from "sonner";
import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  localeDirection,
  normalizeLocale,
  type Locale,
} from "./lib/locale";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

const META: Record<"ar" | "en", { title: string; description: string }> = {
  ar: {
    title: "مدارس الأحد — مكان لأولادنا في المرحلة الابتدائية",
    description:
      "خدمة مدارس الأحد، نتعلّم فيها كلمة الله ونكبر معًا في المحبة. متابعة الحضور والغياب، الفصول، الأطفال، والافتقاد.",
  },
  en: {
    title: "Sunday School — a place for our children",
    description:
      "Sunday School ministry: learn God's word and grow together in love. Track attendance, classes, children, and follow-ups.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function requestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const copy = META[locale === "ar" ? "ar" : "en"];
  return { title: copy.title, description: copy.description };
}

/**
 * Runs before hydration so visitors migrating from the localStorage-only
 * implementation never see the wrong text direction while React boots.
 */
const localeBootstrap = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=([^;]+)/);if(m)return;var l=window.localStorage.getItem('${LOCALE_STORAGE_KEY}');if(l==='ar'){document.documentElement.lang='ar';document.documentElement.dir='rtl'}else if(l){document.documentElement.lang=l;document.documentElement.dir='ltr'}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await requestLocale();

  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={cairo.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeBootstrap }} />
      </head>
      <body className="antialiased min-h-screen">
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        <Analytics />
        <Toaster position="top-center" richColors closeButton duration={3500} />
        <BibleWidget />
      </body>
    </html>
  );
}
