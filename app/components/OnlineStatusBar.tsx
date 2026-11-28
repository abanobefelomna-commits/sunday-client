"use client";

/**
 * OnlineStatusBar
 *
 * A fixed top banner that communicates connectivity and sync state.
 * Renders nothing while online and idle — zero visual noise for normal use.
 *
 * States shown:
 *  offline        → amber "No connection — changes saved offline" (+ pending count)
 *  syncing        → blue  "Syncing…"
 *  synced         → green "Synced ✓" (auto-dismiss after 3 s)
 *  failed         → red   "Sync failed — tap to retry" (+ retry button)
 *  pending+online → blue  "N changes waiting to sync" (+ sync/retry button)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  subscribeSyncStatus,
  syncNow,
  attachNetworkListener,
  type SyncStatus,
} from "../lib/sync-engine";
import { useI18n } from "../lib/app-i18n";
import { useOnlineStatus } from "../lib/use-online-status";

interface SyncViewState {
  syncStatus: SyncStatus;
  pending: number;
  failedCount: number;
  lastError: string | null;
  /** While syncStatus === "synced" this flips false after 3 s. */
  syncedVisible: boolean;
}

export default function OnlineStatusBar() {
  const { t } = useI18n();
  const online = useOnlineStatus();
  const [syncView, setSyncView] = useState<SyncViewState>({
    syncStatus: "idle",
    pending: 0,
    failedCount: 0,
    lastError: null,
    syncedVisible: false,
  });
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attachNetworkListener();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus((syncStatus, pending, failedCount, lastError) => {
      setSyncView({
        syncStatus,
        pending,
        failedCount,
        lastError,
        syncedVisible: syncStatus === "synced",
      });

      if (syncStatus === "synced") {
        if (dismissRef.current) clearTimeout(dismissRef.current);
        dismissRef.current = setTimeout(() => {
          setSyncView((s) => ({ ...s, syncedVisible: false }));
        }, 3000);
      } else if (dismissRef.current) {
        clearTimeout(dismissRef.current);
        dismissRef.current = null;
      }
    });

    return () => {
      unsubscribe();
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    void syncNow({ includeFailed: true });
  }, []);

  const { syncStatus, pending, failedCount, lastError, syncedVisible } = syncView;

  const visible =
    !online ||
    syncStatus === "syncing" ||
    syncStatus === "failed" ||
    failedCount > 0 ||
    (syncStatus === "synced" && syncedVisible) ||
    (online && pending > 0);

  if (!visible) return null;

  let bg = "#1e2a5a";
  const fg = "#fff";
  let message = "";
  let showRetry = false;
  let showSpinner = false;

  if (!online) {
    bg = "#92400e";
    message = t("offline.bar.offline");
    if (pending > 0) message += ` · ${t("offline.bar.pendingCount", { count: pending })}`;
  } else if (syncStatus === "syncing") {
    bg = "#1d4ed8";
    message = t("offline.bar.syncing");
    showSpinner = true;
  } else if (syncStatus === "synced") {
    bg = "#166534";
    message = t("offline.bar.synced");
  } else if (syncStatus === "failed" || failedCount > 0) {
    bg = "#991b1b";
    message = lastError && lastError !== "network error"
      ? `${t("offline.bar.failed")} (${lastError})`
      : t("offline.bar.failed");
    showRetry = true;
  } else if (online && pending > 0) {
    bg = "#1d4ed8";
    message = t("offline.bar.pendingCount", { count: pending });
    showRetry = true;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="online-status-bar"
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        width: "100%",
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 600,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
        fontFamily: "var(--font-cairo, system-ui, sans-serif)",
        boxShadow: "0 2px 8px rgba(0,0,0,.18)",
        transition: "background 0.3s",
      }}
    >
      {showSpinner && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            border: "2px solid rgba(255,255,255,.4)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      )}
      <span>{message}</span>
      {showRetry && (
        <button
          type="button"
          onClick={handleRetry}
          style={{
            background: "rgba(255,255,255,.18)",
            border: "1px solid rgba(255,255,255,.4)",
            color: "#fff",
            borderRadius: 8,
            padding: "2px 10px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t("offline.bar.retry")}
        </button>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
