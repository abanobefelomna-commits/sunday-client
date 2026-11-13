/**
 * Presence cookie used by `proxy.ts` for server-side routing decisions.
 * It is httpOnly and never accepted by API routes for authorization; API
 * requests still require the signed access token + refresh cookie rotation.
 */
export const SESSION_COOKIE = "ss_session";
export const SESSION_COOKIE_VALUE = "1";
export const SESSION_COOKIE_PATH = "/";
