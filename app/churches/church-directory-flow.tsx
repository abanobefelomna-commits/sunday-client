"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, BadgeCheck, MapPin, Search } from "lucide-react";
import { PublicFlowShell } from "@/app/components/public-site/PublicFlowShell";
import { usePublicLocale } from "@/app/components/public-site/use-public-locale";

interface PublicChurch {
  slug: string;
  name: string;
  city: string | null;
  publicDescription: string | null;
  verificationStatus: "verified" | "unverified" | "pending" | "rejected";
}

interface DirectoryResponse { data?: PublicChurch[] }

export default function ChurchDirectoryFlow() {
  const { flow } = usePublicLocale();
  const [search, setSearch] = useState("");
  const [churches, setChurches] = useState<PublicChurch[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const loadChurches = useCallback(async (query: string) => {
    setLoading(true);
    setUnavailable(false);
    try {
      const response = await fetch(`/api/public/churches?search=${encodeURIComponent(query)}`, { cache: "no-store" });
      const body = await response.json() as DirectoryResponse;
      if (!response.ok || !Array.isArray(body.data)) throw new Error("directory unavailable");
      setChurches(body.data.filter((church) => typeof church.slug === "string" && typeof church.name === "string"));
    } catch {
      setChurches([]);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadChurches(""); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChurches]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadChurches(search.trim());
  }

  return <PublicFlowShell>
    <div className={"pf-flowHeading"}>
      <span className={"pf-flowEyebrow"}>{flow.findAction}</span>
      <h1>{flow.directoryTitle}</h1>
      <p>{flow.directoryLead}</p>
    </div>
    <section className={"pf-flowCard"} aria-label={flow.directoryTitle}>
      <form className={"pf-searchForm"} role="search" onSubmit={submit}>
        <input className={"pf-searchInput"} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={flow.search} aria-label={flow.search} />
        <button className={"pf-formButton"} type="submit" disabled={loading}><Search size={16} />{flow.searchSubmit}</button>
      </form>
      {loading && <div className={"pf-loadingRow"} role="status"><span className={"pf-spinner"} />{flow.searchSubmit}…</div>}
      {!loading && unavailable && <p className={"pf-noticeMessage"} role="status">{flow.searchUnavailable}</p>}
      {!loading && !unavailable && churches.length === 0 && <p className={"pf-noticeMessage"} role="status">{flow.searchEmpty}</p>}
      {!loading && churches.length > 0 && <div className={"pf-churchList"}>
        {churches.map((church) => <article className={"pf-churchCard"} key={church.slug}>
          <div>
            <h2>{church.name}</h2>
            {church.city && <p><MapPin size={13} aria-hidden="true" /> {church.city}</p>}
            {church.publicDescription && <p>{church.publicDescription}</p>}
            <span className={`${"pf-churchStatus"} ${church.verificationStatus !== "verified" ? "pf-churchStatusUnverified" : ""}`}>
              <BadgeCheck size={14} aria-hidden="true" />{church.verificationStatus === "verified" ? flow.verified : flow.unverified}
            </span>
          </div>
          <Link className={"pf-flowAction"} href={`/join?church=${encodeURIComponent(church.slug)}`}>{flow.findAction}<ArrowUpRight size={15} /></Link>
        </article>)}
      </div>}
      <Link className={"pf-joinLink"} href="/join">{flow.joinAction}</Link>
    </section>
  </PublicFlowShell>;
}
