type JsonRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9-]{2,63}$/;
const PROVISION_STATES = new Set(["queued", "running", "succeeded", "failed", "canceled"]);
const VERIFICATION_STATES = new Set(["verified", "unverified"]);

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function safeChurch(value: unknown): JsonRecord | null {
  const source = record(value);
  if (!source) return null;

  const slug = safeText(source.slug, 63);
  const name = safeText(source.name, 200);
  if (!slug || !SLUG_PATTERN.test(slug) || !name) return null;

  const verificationStatus = typeof source.verificationStatus === "string" && VERIFICATION_STATES.has(source.verificationStatus)
    ? source.verificationStatus
    : "unverified";

  return {
    slug,
    name,
    city: safeText(source.city, 120),
    publicDescription: safeText(source.publicDescription, 500),
    verificationStatus,
  };
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

/** Return only fields the public visitor UI is allowed to receive. */
export function sanitizePublicSuccess(method: string, path: string, value: unknown): JsonRecord | null {
  const body = record(value);
  if (!body) return null;

  if (method === "GET" && path === "churches") {
    if (!Array.isArray(body.data)) return null;
    return { data: body.data.slice(0, 100).map(safeChurch).filter((church): church is JsonRecord => church !== null) };
  }

  if (method === "GET" && path === "preview") {
    const source = record(body.preview) ?? body;
    const result: JsonRecord = {};
    if (source.mode === "PREVIEW" || source.mode === "LIVE") result.mode = source.mode;
    const launchDate = isoDate(source.officialLaunchDate ?? source.previewStartDate ?? source.startDate);
    const endDate = isoDate(source.previewEndDate ?? source.endDate);
    if (launchDate) result.officialLaunchDate = launchDate;
    if (endDate) result.previewEndDate = endDate;
    if (typeof source.subscriptionsEnabled === "boolean") result.subscriptionsEnabled = source.subscriptionsEnabled;
    if (typeof source.paymentsEnabled === "boolean") result.paymentsEnabled = source.paymentsEnabled;
    return result;
  }

  if (method === "GET" && /^church-registrations\/[0-9a-f-]{36}\/status$/i.test(path)) {
    if (typeof body.status !== "string" || !PROVISION_STATES.has(body.status)) return null;
    const result: JsonRecord = { status: body.status };
    if (typeof body.progress === "number" && Number.isFinite(body.progress)) {
      result.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
    }
    if (body.status === "succeeded") {
      const churchCode = safeText(body.churchCode, 128);
      if (!churchCode || !/^[A-Za-z0-9_-]+$/.test(churchCode)) return null;
      result.churchCode = churchCode;
    }
    return result;
  }

  if (method === "POST" && path === "church-registrations") {
    const jobId = safeText(body.jobId, 36);
    const provisioningToken = safeText(body.provisioningToken, 512);
    if (!jobId || !UUID_PATTERN.test(jobId) || !provisioningToken || provisioningToken.length < 32) return null;
    return { jobId, provisioningToken };
  }

  if (method === "POST" && path === "church-code/lookup") {
    const church = safeChurch(body.church);
    return church ? { church } : null;
  }

  if (method === "POST" && path === "join-requests") {
    return body.status === "pending" ? { status: "pending" } : null;
  }

  return null;
}
