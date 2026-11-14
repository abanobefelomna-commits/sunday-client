import type { Metadata } from "next";
import { cookies } from "next/headers";
import PublicLanding from "./components/public-site/PublicLanding";
import type { Locale } from "./components/public-site/messages";
import { LOCALE_COOKIE, normalizeLocale } from "./lib/locale";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "مدارس الأحد — مساحة عصرية لخدمة الكنيسة",
    description: "نظّم مدارس الأحد والأطفال والفصول والحضور والخدام والمتابعة في مساحة واحدة.",
  },
  en: {
    title: "Sunday School — a modern workspace for church ministry",
    description: "Organize Sunday School, children, classes, attendance, servants, and follow-ups in one place.",
  },
  fr: {
    title: "École du Dimanche — un espace moderne pour le ministère",
    description: "Organisez l'École du Dimanche, les enfants, les classes, la présence, les serviteurs et les suivis au même endroit.",
  },
  es: {
    title: "Escuela Dominical — un espacio moderno para el ministerio",
    description: "Organiza la Escuela Dominical, los niños, las clases, la asistencia, los servidores y el seguimiento en un solo lugar.",
  },
  de: {
    title: "Sonntagsschule — ein moderner Arbeitsbereich für den Dienst",
    description: "Sonntagsschule, Kinder, Klassen, Anwesenheit, Mitarbeiter und Nachverfolgung an einem Ort organisieren.",
  },
  it: {
    title: "Scuola Domenicale — uno spazio moderno per il ministero",
    description: "Organizza la Scuola Domenicale, i bambini, le classi, la presenza, i servitori e i follow-up in un unico posto.",
  },
  pt: {
    title: "Escola Dominical — um espaço moderno para o ministério",
    description: "Organize a Escola Dominical, as crianças, as turmas, a presença, os servidores e os acompanhamentos num só lugar.",
  },
  ru: {
    title: "Воскресная школа — современное пространство для служения",
    description: "Воскресная школа, дети, классы, посещаемость, служители и работа с детьми — всё в одном месте.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const copy = META[locale];

  return {
    title: copy.title,
    description: copy.description,
    openGraph: {
      title: copy.title,
      description: copy.description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
    },
  };
}

export default function LandingPage() {
  return <PublicLanding />;
}
