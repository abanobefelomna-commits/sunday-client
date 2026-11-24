"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BadgeCheck, Church, MapPin } from "lucide-react";
import { sharedPublicCopy } from "@/app/components/public-site/shared-copy";
import { usePublicLocale } from "@/app/components/public-site/use-public-locale";
import { PublicFlowShell } from "@/app/components/public-site/PublicFlowShell";

interface MatchedChurch {
  slug: string;
  name: string;
  city: string | null;
  publicDescription: string | null;
  verificationStatus: "verified" | "unverified" | "pending" | "rejected";
}

export default function JoinChurchFlow() {
  const router = useRouter();
  const { flow, locale } = usePublicLocale();
  const sharedCopy = sharedPublicCopy[locale];
  const [code, setCode] = useState("");
  const [church, setChurch] = useState<MatchedChurch | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("church");
    if (value && /^[a-z0-9-]{2,63}$/.test(value)) {
      window.setTimeout(() => { void lookup({ slug: value }); }, 0);
    }
  // Initial directory links are resolved after hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(input: { code?: string; slug?: string }) {
    setBusy(true);
    setError("");
    setChurch(null);
    try {
      const response = await fetch("/api/public/church-code/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json() as { church?: MatchedChurch; message?: string };
      if (!response.ok || !body.church?.slug || !body.church.name) {
        throw new Error(body.message || flow.lookupError);
      }

      // A valid join code takes the servant straight to that church's
      // registration page. The code is carried in sessionStorage so it is
      // never exposed in the URL or in browser history.
      if (input.code) {
        try {
          window.sessionStorage.setItem("churchJoinCode", input.code.trim().toUpperCase());
        } catch {
          throw new Error("تعذر حفظ رمز الكنيسة. يرجى السماح بالتخزين المؤقت أو إدخال الرمز في صفحة التسجيل.");
        }
        router.push(`/register?church=${encodeURIComponent(body.church.slug)}`);
        return;
      }

      setChurch(body.church);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : flow.lookupError);
    } finally {
      setBusy(false);
    }
  }

  function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (trimmed) void lookup({ code: trimmed });
  }

  return <PublicFlowShell>
    <div className={"pf-flowHeading"}>
      <span className={"pf-flowEyebrow"}>{flow.joinAction}</span>
      <h1>{flow.joinTitle}</h1>
      <p>{flow.joinLead}</p>
    </div>
    <section className={"pf-flowCard"}>
      <form className={"pf-flowForm"} onSubmit={submitLookup}>
        <label className={"pf-field"}>{flow.codeLabel}
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" maxLength={64} aria-describedby="church-code-help" />
          <small id="church-code-help">{sharedCopy.codeOrDirectoryHint} <Link href="/churches">{flow.findAction}</Link></small>
        </label>
        <button className={"pf-formButton"} type="submit" disabled={busy || !code.trim()}><Church size={16} />{busy ? flow.submitting : flow.lookup}<ArrowUpRight size={16} /></button>
      </form>
      {error && <p className={"pf-errorMessage"} role="alert">{error}</p>}
      {church && <div className={"pf-matchCard"}>
        <span className={"pf-flowEyebrow"}>{flow.matchedChurch}</span>
        <h2>{church.name}</h2>
        {church.city && <p><MapPin size={13} aria-hidden="true" /> {church.city}</p>}
        {church.publicDescription && <p>{church.publicDescription}</p>}
        <span className={church.verificationStatus !== "verified" ? "pf-churchStatus pf-churchStatusUnverified" : "pf-churchStatus"}><BadgeCheck size={14} />{church.verificationStatus === "verified" ? flow.verified : flow.unverified}</span>
        <Link className={"pf-flowAction"} href={`/register?church=${encodeURIComponent(church.slug)}`}>
          {sharedCopy.createServantAccount}<ArrowUpRight size={15} />
        </Link>
        <Link className={"pf-joinLink"} href="/login">{flow.signIn}</Link>
      </div>}
    </section>
  </PublicFlowShell>;
}
