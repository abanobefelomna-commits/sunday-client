"use client";

/**
 * InstallPrompt — shows the browser-native "Add to Home Screen" prompt.
 *
 * Rules:
 *  - Only shown if the browser fires `beforeinstallprompt` (Chrome/Edge/Android).
 *  - Not shown if already installed in standalone mode.
 *  - Dismissed for the session if the user clicks "not now".
 *  - Shows after a 10-second delay while online.
 *  - Hidden while offline.
 */

import { useEffect, useState } from "react";
import { useI18n } from "../lib/app-i18n";
import { useOnlineStatus } from "../lib/use-online-status";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "ss_install_dismissed";

export default function InstallPrompt() {
  const { t } = useI18n();
  const isOnline = useOnlineStatus();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (navigator.onLine) setVisible(true);
      }, 10_000);
    };

    const onInstalled = () => {
      sessionStorage.setItem(DISMISSED_KEY, "1");
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      sessionStorage.setItem(DISMISSED_KEY, "1");
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  if (!visible || !deferredPrompt || !isOnline) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("pwa.installTitle")}
      style={{
        position: "fixed",
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 9000,
        background: "#fff",
        border: "1px solid #e3e6f0",
        borderRadius: 20,
        padding: "18px 20px",
        boxShadow: "0 20px 40px -15px rgba(30,42,90,.35)",
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        fontFamily: "var(--font-cairo, system-ui, sans-serif)",
        maxWidth: 420,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 32, lineHeight: 1 }} aria-hidden="true">📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 15, color: "#1e2a5a", display: "block" }}>
          {t("pwa.installTitle")}
        </b>
        <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#5a6480", lineHeight: 1.7 }}>
          {t("pwa.installBody")}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleInstall}
            style={{
              background: "#1e2a5a",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("pwa.installButton")}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: "#f1f3f9",
              color: "#5a6480",
              border: "none",
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("pwa.installDismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
