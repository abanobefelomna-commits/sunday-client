/**
 * Strict internal redirect validator to prevent Open Redirect vulnerabilities.
 *
 * Rejects:
 * - External URLs (e.g. https://evil.com)
 * - Protocol-relative URLs (e.g. //evil.com, ///evil.com)
 * - Backslash bypasses (e.g. /\evil.com, /\\evil.com, \evil.com)
 * - Scheme bypasses (e.g. javascript:, data:, vbscript:)
 * - Control characters, CRLF, and null bytes (%00, \r, \n)
 * - Double-encoded variants (%2f, %5c)
 */
export function safeNextPath(
  value: unknown,
  fallback: string | null = '/dashboard',
): string | null {
  if (typeof value !== 'string') return fallback;

  const raw = value.trim();
  if (!raw || raw.length > 2048) return fallback;

  // Reject control characters (0x00-0x1F, 0x7F) and CRLF
  if (/[\x00-\x1F\x7F]/.test(raw)) return fallback;

  // Must begin with a single slash
  if (!raw.startsWith('/')) return fallback;

  // Reject protocol-relative '//' and Windows backslash bypasses '/\'
  if (raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('\\')) {
    return fallback;
  }

  // Backslashes anywhere in the path can be interpreted by browsers as path separators
  if (raw.includes('\\')) return fallback;

  // Reject raw attempts to inject schemes like '/http:evil.com' or 'javascript:'
  const pathPart = raw.split(/[?#]/)[0];
  if (pathPart.includes(':')) return fallback;

  // Decode URI component and test again against backslashes and double-slashes
  try {
    const decoded = decodeURIComponent(raw);
    if (/[\x00-\x1F\x7F]/.test(decoded)) return fallback;
    if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.startsWith('\\')) {
      return fallback;
    }
    if (decoded.includes('\\')) return fallback;
    const decodedPath = decoded.split(/[?#]/)[0];
    if (decodedPath.includes(':')) return fallback;
  } catch {
    // Malformed percent-encoding
    return fallback;
  }

  return raw;
}
