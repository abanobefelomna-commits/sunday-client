"use client";

import Link from "next/link";
import { Church, Globe2 } from "lucide-react";
import { localeLabels, supportedLocales } from "./messages";
import { sharedPublicCopy } from "./shared-copy";
import { usePublicLocale } from "./use-public-locale";

export function PublicFlowShell({ children }: { children: React.ReactNode }) {
  const { locale, direction, messages, flow, setLocale } = usePublicLocale();
  const sharedCopy = sharedPublicCopy[locale];
  return (
    <div className={"pf-flowSite"} dir={direction}>
      <a className={"pf-skipLink"} href="#flow-main">{sharedCopy.skipToContent}</a>
      <header className={"pf-flowHeader"}>
        <div className={"pf-flowHeaderInner"}>
          <Link className={"pf-flowBrand"} href="/">
            <span className={"pf-flowBrandMark"}><Church size={21} aria-hidden="true" /></span>
            <span>{messages.name}<small>Sunday School</small></span>
          </Link>
          <nav className={"pf-flowNav"} aria-label={messages.name}>
            <Link href="/churches">{messages.nav.churches}</Link>
            <Link href="/join">{flow.joinAction}</Link>
            <Link href="/login">{messages.login}</Link>
          </nav>
          <label className={"pf-flowLanguage"}>
            <Globe2 size={16} aria-hidden="true" />
            <span className={"pf-visuallyHidden"}>{messages.language}</span>
            <select aria-label={messages.language} value={locale} onChange={(event) => setLocale(event.target.value)}>
              {supportedLocales.map((code) => <option key={code} value={code}>{localeLabels[code]}</option>)}
            </select>
          </label>
        </div>
      </header>
      <main id="flow-main" className={"pf-flowMain"}>{children}</main>
      <footer className={"pf-flowFooter"}>
        <span>{messages.name}</span>
        <span><Link href="/privacy">{messages.privacy}</Link><Link href="/terms">{messages.terms}</Link></span>
      </footer>
    </div>
  );
}
