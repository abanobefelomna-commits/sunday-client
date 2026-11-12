"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Church } from "lucide-react";
import { PublicFlowShell } from "@/app/components/public-site/PublicFlowShell";
import { sharedPublicCopy } from "@/app/components/public-site/shared-copy";
import { usePublicLocale } from "@/app/components/public-site/use-public-locale";

type RegistrationResponse = { jobId?: string; provisioningToken?: string; message?: string };

export default function RegisterChurchFlow() {
  const { flow, locale } = usePublicLocale();
  const sharedCopy = sharedPublicCopy[locale];
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const adminName = String(form.get("adminName") || "").trim();
    const adminEmail = String(form.get("adminEmail") || "").trim();
    const adminPhone = String(form.get("adminPhone") || "").trim();
    const payload = {
      churchName: String(form.get("churchName") || "").trim(),
      city: String(form.get("city") || "").trim() || undefined,
      publishInDirectory: form.get("publishInDirectory") === "on",
      contactName: adminName,
      contactEmail: adminEmail,
      contactPhone: adminPhone,
      adminName,
      adminEmail,
      adminPhone,
      adminPassword: String(form.get("adminPassword") || ""),
      acceptTerms: form.get("acceptTerms") === "on",
      acceptPrivacy: form.get("acceptPrivacy") === "on",
    };

    try {
      const response = await fetch("/api/public/church-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as RegistrationResponse;
      if (!response.ok || !result.jobId || !result.provisioningToken) {
        setError(result.message || flow.requestError);
        return;
      }
      window.sessionStorage.setItem(`ss:provision:${result.jobId}`, result.provisioningToken);
      router.push(`/register/church/provisioning?jobId=${encodeURIComponent(result.jobId)}`);
    } catch {
      setError(flow.requestError);
    } finally {
      const passwordInput = formElement.elements.namedItem("adminPassword");
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
      setBusy(false);
    }
  }

  return <PublicFlowShell>
    <div className={"pf-flowHeading"}>
      <span className={"pf-flowEyebrow"}>{sharedCopy.getStarted}</span>
      <h1>{flow.registerTitle}</h1>
      <p>{flow.registerLead}</p>
    </div>
    <form className={`${"pf-flowCard"} ${"pf-flowForm"}`} onSubmit={submit}>
      <label className={"pf-field"}>{flow.churchName}
        <input name="churchName" autoComplete="organization" minLength={2} maxLength={200} required />
        <small>{flow.churchNameHint}</small>
      </label>
      <label className={"pf-field"}>{flow.city}
        <input name="city" autoComplete="address-level2" maxLength={120} />
        <small>{flow.cityHint}</small>
      </label>
      <label className={"pf-checkField"}>
        <input type="checkbox" name="publishInDirectory" />
        <span>{flow.publish}</span>
      </label>
      <hr />
      <label className={"pf-field"}>{flow.adminName}<input name="adminName" autoComplete="name" maxLength={160} required /></label>
      <label className={"pf-field"}>{flow.email}<input name="adminEmail" type="email" autoComplete="email" maxLength={320} required /></label>
      <label className={"pf-field"}>{flow.phone}<input name="adminPhone" type="tel" autoComplete="tel" maxLength={30} required /></label>
      <label className={"pf-field"}>{flow.password}
        <input name="adminPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
        <small>{flow.passwordHint}</small>
      </label>
      <label className={"pf-checkField"}><input type="checkbox" name="acceptTerms" required /><span>{flow.acceptTerms} <Link href="/terms">{sharedCopy.readDraft}</Link></span></label>
      <label className={"pf-checkField"}><input type="checkbox" name="acceptPrivacy" required /><span>{flow.acceptPrivacy} <Link href="/privacy">{sharedCopy.readDraft}</Link></span></label>
      {error && <p className={"pf-errorMessage"} role="alert">{error}</p>}
      <button className={"pf-formButton"} type="submit" disabled={busy}>
        <Church size={17} aria-hidden="true" />{busy ? flow.submitting : flow.submit}<ArrowUpRight size={16} aria-hidden="true" />
      </button>
    </form>
  </PublicFlowShell>;
}
