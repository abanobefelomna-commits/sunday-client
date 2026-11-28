/* Sunday School service worker — v3
 *
 * Caching policy:
 *  • Static build assets (_next/static, icons, fonts, images)
 *    → Cache-first (content-hashed; safe to serve stale)
 *  • Page navigations (excluding auth routes)
 *    → Network-first with offline fallback to /offline
 *  • API requests & auth routes (/api/*, /login, /logout, /register, /verify-*)
 *    → NEVER cached. All reads and mutations go directly to the server.
 *  • Service-worker script itself (/sw.js) & manifest
 *    → Never intercepted
 *
 * On logout the page sends CLEAR_DATA (optionally with a MessageChannel port),
 * which wipes all caches and re-precaches the shell offline fallback.
 */

const VERSION = "v3";
const SHELL_CACHE = `ss-shell-${VERSION}`;
const PAGES_CACHE = `ss-pages-${VERSION}`;
const ASSETS_CACHE = `ss-assets-${VERSION}`;
const ALL_CACHES = [SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE];

const OFFLINE_URL = "/offline";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
];

const NO_CACHE_PAGE_PREFIXES = [
  "/login",
  "/logout",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-otp",
  "/super-admin",
];

function shouldCacheNavigation(pathname) {
  return !NO_CACHE_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res);
      } catch {
        // Individual precache failure should not prevent SW activation
      }
    }),
  );
}

// ── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

// ── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !ALL_CACHES.includes(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Messages ──────────────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "CLEAR_DATA") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => precacheShell())
        .finally(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ ok: true });
          }
        }),
    );
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    /\.(?:png|jpe?g|webp|svg|ico|woff2?|ttf|otf|css|js)$/.test(url.pathname)
  );
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests from our own origin
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls, the manifest, or the SW itself
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/manifest.webmanifest"
  ) {
    return;
  }

  // ── Static assets → cache-first ───────────────────────────────────────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // ── Navigations → network-first with offline fallback ────────────────────
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          // Cache successful, non-redirect, non-auth responses only.
          // A redirect to /login must NOT be cached as the page content.
          if (response.ok && !response.redirected && shouldCacheNavigation(url.pathname)) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          if (shouldCacheNavigation(url.pathname)) {
            const cached = await cache.match(request);
            if (cached) return cached;
          }
          const shellCache = await caches.open(SHELL_CACHE);
          const offline = (await shellCache.match(OFFLINE_URL)) || (await caches.match(OFFLINE_URL));
          return offline || Response.error();
        }
      }),
    );
  }
});
