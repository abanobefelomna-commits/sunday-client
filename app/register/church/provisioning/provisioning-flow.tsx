"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Church, Copy, ShieldCheck } from "lucide-react";
import { PublicFlowShell } from "@/app/components/public-site/PublicFlowShell";
import { usePublicLocale } from "@/app/components/public-site/use-public-locale";

type ProvisionStatus = {
  status?: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress?: number;
  churchCode?: string;
  error?: { code?: string; message?: string } | null;
};

export default function ChurchProvisioningFlow() {
  const { flow } = usePublicLocale();
  const [jobId, setJobId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<ProvisionStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("jobId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      window.setTimeout(() => setUnavailable(true), 0);
      return;
    }
    const storedToken = window.sessionStorage.getItem(`ss:provision:${id}`) || "";
    window.setTimeout(() => {
      setJobId(id);
      setToken(storedToken);
    }, 0);
  }, []);

  useEffect(() => {
    if (!jobId || !token || status?.status === "succeeded" || status?.status === "failed") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/public/church-registrations/${jobId}/status`, {
          headers: { "X-Provisioning-Token": token },
          cache: "no-store",
        });
        const value = await response.json() as ProvisionStatus;
        if (!active) return;
        if (!response.ok) throw new Error("status unavailable");
        setStatus(value);
        setUnavailable(false);
      } catch {
        if (active) setUnavailable(true);
      }
      if (active) timer = setTimeout(poll, 4000);
    };
    void poll();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [jobId, token, status?.status]);

  async function copyCode() {
    if (!status?.churchCode) return;
    try {
      await navigator.clipboard.writeText(status.churchCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  const completed = status?.status === "succeeded";
  const failed = status?.status === "failed" || status?.status === "canceled";
  const progress = Math.max(0, Math.min(100, status?.progress ?? 8));

  return <PublicFlowShell>
    <div className={"pf-flowHeading"}>
      <span className={"pf-flowEyebrow"}>{flow.registerTitle}</span>
      <h1>{completed ? flow.churchCode : flow.provisioningTitle}</h1>
      <p>{completed ? flow.requestPending : flow.provisioningLead}</p>
    </div>
    <section className={"pf-statusCard"} aria-live="polite">
      <span className={"pf-statusIcon"}>{completed ? <BadgeCheck size={25} /> : failed ? <Church size={25} /> : <span className={"pf-spinner"} />}</span>
      {completed && status?.churchCode ? <>
        <h2>{flow.churchCode}</h2>
        <p>{flow.provisioningLead}</p>
        <div className={"pf-codeBlock"}>
          <code dir="ltr">{status.churchCode}</code>
          <button type="button" onClick={copyCode}><Copy size={15} />{copied ? flow.codeCopied : flow.copyCode}</button>
        </div>
        <p className={"pf-noticeMessage"}><ShieldCheck size={16} />{flow.joinLead}</p>
      </> : failed ? <>
        <h2>{flow.provisioningFailed}</h2>
      </> : <>
        <h2>{flow.provisioningWait}</h2>
        <div className={"pf-progressTrack"} role="progressbar" aria-label={flow.provisioningWait} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        {unavailable && <p className={"pf-noticeMessage"}>{flow.requestError}</p>}
        {!token && <p className={"pf-noticeMessage"}>{flow.requestError}</p>}
        {jobId && <small>{jobId}</small>}
      </>}
    </section>
  </PublicFlowShell>;
}
