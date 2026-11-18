/**
 * Vercel Analytics receives the full page URL by default, including search
 * parameters, hashes, and record identifiers. This helper keeps only the
 * origin, path, and replaces UUID path segments with a stable placeholder.
 *
 * Pure and dependency-free so it can be unit tested with Node's test runner.
 */

const RELATIVE_ORIGIN = "https://analytics.invalid";

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sanitizeAnalyticsUrl(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return "/";

  let parsed: URL;
  try {
    parsed = new URL(raw, RELATIVE_ORIGIN);
  } catch {
    return "/";
  }

  parsed.search = "";
  parsed.hash = "";

  const pathname =
    parsed.pathname
      .split("/")
      .map((segment) => (UUID_SEGMENT.test(segment) ? "[id]" : segment))
      .join("/") || "/";

  return parsed.origin === RELATIVE_ORIGIN
    ? pathname
    : `${parsed.origin}${pathname}`;
}
