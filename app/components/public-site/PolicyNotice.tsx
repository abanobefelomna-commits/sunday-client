"use client";

import Link from "next/link";
import { PublicFlowShell } from "./PublicFlowShell";
import { usePublicLocale } from "./use-public-locale";
import { privacyPolicy, termsPolicy, type PolicyDoc } from "./policies";

export default function PolicyNotice({ kind }: { kind: "privacy" | "terms" }) {
  const { locale, messages } = usePublicLocale();
  const source = kind === "privacy" ? privacyPolicy : termsPolicy;
  const doc: PolicyDoc = source[locale === "ar" ? "ar" : "en"];
  return (
    <PublicFlowShell>
      <article className={"pf-policyBody"}>
        <span className={"pf-flowEyebrow"}>{messages.name}</span>
        <h1>{doc.title}</h1>
        <p className={"pf-policyUpdated"}>{doc.updated}</p>
        <p>{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <Link className={"pf-flowAction"} href="/">{messages.nav.home}</Link>
      </article>
    </PublicFlowShell>
  );
}
