"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that provides installability and offline page
 * fallbacks. Registration is progressive enhancement: when the browser does
 * not support service workers the app works exactly as before.
 *
 * Also handles the SW update lifecycle cleanly:
 *  - On first install, activates silently without forcing a page reload.
 *  - When an update replaces an already-active SW while online, promotes and
 *    reloads once so users get the latest assets cleanly.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let registration: ServiceWorkerRegistration | null = null;

    const promoteWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    const onControllerChange = () => {
      // Only reload when an existing controller was replaced by an update
      // (never on first-time install, and never while offline).
      if (!hadController || reloading || !navigator.onLine) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

        if (registration.waiting && navigator.serviceWorker.controller) {
          promoteWaiting(registration);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller && registration) {
              promoteWaiting(registration);
            }
          });
        });
      } catch {
        // SW registration failed — silent fail, app keeps working without SW.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      const handler = () => {
        void register();
      };
      window.addEventListener("load", handler, { once: true });
      return () => {
        window.removeEventListener("load", handler);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
