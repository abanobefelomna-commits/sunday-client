"use client";

import { useEffect } from "react";
import { useLocale } from "../LocaleProvider";
import { landingMessages } from "./messages";
import { getFlowMessages } from "./flow-messages";

/**
 * Public landing/flow copy bound to the application-wide locale provider.
 * The selected language lives in one place (`ss_locale` cookie + provider);
 * this hook must never keep its own locale state.
 */
export function usePublicLocale() {
  const { locale, direction, setLocale } = useLocale();
  const messages = landingMessages[locale];
  const flow = getFlowMessages(locale);

  useEffect(() => {
    const path = window.location.pathname;
    const isPublicRoute = path === "/" || path === "/churches" || path === "/join" || path.startsWith("/register/church") || path === "/privacy" || path === "/terms";
    document.body.classList.toggle("public-visitor-page", isPublicRoute);
    const pageTitle = path === "/"
      ? `${messages.name} — ${messages.nav.home}`
      : path.startsWith("/register/church")
        ? flow.registerTitle
        : path === "/churches"
          ? flow.directoryTitle
          : path === "/join"
            ? flow.joinTitle
            : path === "/privacy"
              ? messages.privacy
              : path === "/terms"
                ? messages.terms
                : messages.name;
    document.title = `${pageTitle} | ${messages.name}`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const localizedDescription = path === "/"
      ? messages.heroLead
      : path.startsWith("/register/church")
        ? flow.registerLead
        : path === "/churches"
          ? flow.directoryLead
          : path === "/join"
            ? flow.joinLead
            : flow.policyReview;
    if (description) {
      description.content = localizedDescription;
    }
    const socialTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    const socialDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    const twitterDescription = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (socialTitle) socialTitle.content = `${pageTitle} | ${messages.name}`;
    if (socialDescription) socialDescription.content = localizedDescription;
    if (twitterTitle) twitterTitle.content = `${pageTitle} | ${messages.name}`;
    if (twitterDescription) twitterDescription.content = localizedDescription;
    return () => document.body.classList.remove("public-visitor-page");
  }, [flow, locale, messages]);

  return {
    locale,
    direction,
    messages,
    flow,
    setLocale,
  };
}
