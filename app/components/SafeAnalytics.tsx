"use client";

import { Analytics } from "@vercel/analytics/next";
import { sanitizeAnalyticsUrl } from "../lib/analytics-sanitizer";

/**
 * Privacy-preserving wrapper around Vercel Analytics. Query strings, hashes,
 * and UUID path segments never leave the browser.
 */
export default function SafeAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => ({
        ...event,
        url: sanitizeAnalyticsUrl(event.url),
      })}
    />
  );
}
