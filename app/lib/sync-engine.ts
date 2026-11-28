"use client";

/**
 * Synchronisation engine — runs in the browser.
 *
 * Responsibility:
 *  1. Watch the network state & tab visibility.
 *  2. When online, flush the current user's pending attendance queue to `/api/attendance/sync`.
 *  3. Refresh expired access tokens transparently on 401 before failing.
 *  4. Report progress (`idle` | `syncing` | `synced` | `failed`) plus pending & failed counts.
 *  5. Every operation carries a stable `operationId` (UUID v4) for server-side idempotency.
 *
 * Security note:
 *  Operations are scoped to the active authenticated `userId` and validated by
 *  `/api/attendance/sync` against the database (auth + role + class permissions +
 *  child membership). Unsynced records are NEVER silently deleted on failure.
 */

import {
  getUnsyncedOps,
  recoverStaleSyncingOps,
  updateQueuedOp,
  purgeSyncedOps,
  type QueuedAttendanceOp,
} from "./offline-db";
import { getStoredToken, getStoredUser, refreshAccessToken } from "./api";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export interface SyncResult {
  synced: number;
  failed: number;
}

type Listener = (
  status: SyncStatus,
  pending: number,
  failedCount: number,
  lastError: string | null,
) => void;

interface SyncApiOperationResult {
  operationId: string;
  outcome: "applied" | "duplicate" | "rejected";
  retryable?: boolean;
  code?: string;
  message?: string;
}

interface SyncApiResponse {
  results?: SyncApiOperationResult[];
  applied?: number;
  duplicates?: number;
  rejected?: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _status: SyncStatus = "idle";
let _pendingCount = 0;
let _failedCount = 0;
let _lastError: string | null = null;
let _listeners: Listener[] = [];
let _syncInProgress = false;
let _onlineDebounce: ReturnType<typeof setTimeout> | null = null;

function notify() {
  _listeners.forEach((fn) => fn(_status, _pendingCount, _failedCount, _lastError));
}

function setStatus(s: SyncStatus, lastError: string | null = _lastError) {
  _status = s;
  _lastError = lastError;
  notify();
}

function activeUserId(): string | null {
  return getStoredUser()?.id ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function subscribeSyncStatus(fn: Listener): () => void {
  _listeners.push(fn);
  fn(_status, _pendingCount, _failedCount, _lastError);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

export function getSyncStatus(): SyncStatus {
  return _status;
}

export function getPendingCount(): number {
  return _pendingCount;
}

/** Recount unsynced ops for the active user and notify subscribers. */
export async function recheckPending(): Promise<void> {
  const userId = activeUserId();
  if (!userId) {
    _pendingCount = 0;
    _failedCount = 0;
    _lastError = null;
    if (_status !== "idle") _status = "idle";
    notify();
    return;
  }

  if (!_syncInProgress) {
    await recoverStaleSyncingOps(userId).catch(() => 0);
  }

  const ops = await getUnsyncedOps(userId).catch(() => [] as QueuedAttendanceOp[]);
  if (activeUserId() !== userId) return;
  _pendingCount = ops.length;
  const failedOps = ops.filter((op) => op.syncState === "failed");
  _failedCount = failedOps.length;
  _lastError = failedOps[0]?.lastError ?? null;

  if (_pendingCount === 0) {
    if (_status === "failed") _status = "idle";
    notify();
  } else if (_failedCount > 0 && !_syncInProgress) {
    setStatus("failed", _lastError);
  } else if (_status === "synced" && _pendingCount > 0) {
    setStatus("idle", null);
  } else {
    notify();
  }
}

/**
 * Attempt to sync pending (and optionally previously failed) operations.
 * Safe to call multiple times — concurrent calls return immediately.
 */
export async function syncNow(options: { includeFailed?: boolean } = {}): Promise<SyncResult> {
  const userId = activeUserId();
  if (!userId) {
    resetSyncState();
    return { synced: 0, failed: 0 };
  }
  if (_syncInProgress) return { synced: 0, failed: 0 };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await recheckPending();
    return { synced: 0, failed: 0 };
  }

  _syncInProgress = true;
  let synced = 0;
  let failed = 0;

  try {
    await recoverStaleSyncingOps(userId);
    const unsynced = await getUnsyncedOps(userId);

    const toSubmit = unsynced.filter((op) => {
      if (op.syncState === "pending") return true;
      if (op.syncState === "failed") {
        return options.includeFailed ? true : op.retryable !== false;
      }
      return false;
    });

    _pendingCount = unsynced.length;
    _failedCount = unsynced.filter((op) => op.syncState === "failed").length;

    if (toSubmit.length === 0) {
      if (_failedCount > 0) {
        setStatus("failed", unsynced.find((op) => op.syncState === "failed")?.lastError ?? null);
      } else {
        setStatus("idle", null);
      }
      return { synced: 0, failed: 0 };
    }

    setStatus("syncing", null);

    // Group by classId + date so each batch maps cleanly to one class session.
    const groups = groupOps(toSubmit);

    for (const [, ops] of groups) {
      if (activeUserId() !== userId) return { synced: 0, failed: 0 };
      const result = await submitGroup(ops);
      synced += result.synced;
      failed += result.failed;
    }

    if (activeUserId() !== userId) return { synced: 0, failed: 0 };
    await purgeSyncedOps(userId);

    const remaining = await getUnsyncedOps(userId);
    if (activeUserId() !== userId) return { synced: 0, failed: 0 };
    _pendingCount = remaining.length;
    const remainingFailed = remaining.filter((op) => op.syncState === "failed");
    _failedCount = remainingFailed.length;

    if (failed === 0 && _pendingCount === 0) {
      setStatus("synced", null);
    } else if (failed > 0 || _failedCount > 0) {
      const firstErr = remainingFailed[0]?.lastError ?? remaining[0]?.lastError ?? null;
      setStatus("failed", firstErr);
    } else {
      setStatus("idle", null);
    }

    return { synced, failed };
  } finally {
    _syncInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupOps(ops: QueuedAttendanceOp[]): Map<string, QueuedAttendanceOp[]> {
  const map = new Map<string, QueuedAttendanceOp[]>();
  for (const op of ops) {
    const key = `${op.classId}||${op.date}`;
    const list = map.get(key) ?? [];
    list.push(op);
    map.set(key, list);
  }
  return map;
}

async function postSyncBatch(
  ops: QueuedAttendanceOp[],
  token: string | null,
): Promise<Response> {
  return fetch("/api/attendance/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      operations: ops.map((op) => ({
        operationId: op.operationId,
        classId: op.classId,
        date: op.date,
        childId: op.childId,
        status: op.status,
        queuedAt: op.queuedAt,
      })),
    }),
  });
}

async function submitGroup(
  ops: QueuedAttendanceOp[],
): Promise<{ synced: number; failed: number }> {
  for (const op of ops) {
    await updateQueuedOp(op.operationId, { syncState: "syncing" });
  }

  let token = getStoredToken();

  try {
    let res = await postSyncBatch(ops, token);

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        token = refreshed;
        res = await postSyncBatch(ops, token);
      }
    }

    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as SyncApiResponse;
      const resultById = new Map(
        (body.results ?? []).map((r) => [r.operationId.toLowerCase(), r]),
      );

      let synced = 0;
      let failed = 0;

      for (const op of ops) {
        const item = resultById.get(op.operationId.toLowerCase());
        if (!item || item.outcome === "applied" || item.outcome === "duplicate") {
          await updateQueuedOp(op.operationId, {
            syncState: "synced",
            lastError: undefined,
          });
          synced += 1;
        } else {
          await updateQueuedOp(op.operationId, {
            syncState: "failed",
            retryable: item.retryable === true,
            attempts: op.attempts + 1,
            lastError: item.message || item.code || "Sync rejected",
          });
          failed += 1;
        }
      }

      return { synced, failed };
    }

    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const errorMsg = body.message || `HTTP ${res.status}`;
    const isRetryable = res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 401;

    for (const op of ops) {
      await updateQueuedOp(op.operationId, {
        syncState: "failed",
        retryable: isRetryable,
        attempts: op.attempts + 1,
        lastError: errorMsg,
      });
    }
    return { synced: 0, failed: ops.length };
  } catch {
    // Network drop — keep retryable. If browser still reports online, surface
    // "failed" so the user can retry; if offline, keep "pending" quietly.
    const stillOnline = typeof navigator === "undefined" ? true : navigator.onLine;
    for (const op of ops) {
      await updateQueuedOp(op.operationId, {
        syncState: stillOnline ? "failed" : "pending",
        retryable: true,
        attempts: op.attempts + 1,
        lastError: "network error",
      });
    }
    return { synced: 0, failed: ops.length };
  }
}

// ---------------------------------------------------------------------------
// Auto-sync on network restoration
// ---------------------------------------------------------------------------

let _networkListenerAttached = false;

export function attachNetworkListener(): void {
  if (typeof window === "undefined" || _networkListenerAttached) return;
  _networkListenerAttached = true;

  const scheduleSync = (delayMs: number) => {
    if (_onlineDebounce) clearTimeout(_onlineDebounce);
    _onlineDebounce = setTimeout(() => {
      _onlineDebounce = null;
      syncNow();
    }, delayMs);
  };

  window.addEventListener("online", () => {
    scheduleSync(600);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      recheckPending().then(() => {
        if (_pendingCount > 0) syncNow();
      });
    }
  });

  if (navigator.onLine) {
    recheckPending().then(() => {
      if (_pendingCount > 0) syncNow();
    });
  } else {
    recheckPending();
  }
}

/** Call this on logout to reset sync state. */
export function resetSyncState(): void {
  if (_onlineDebounce) {
    clearTimeout(_onlineDebounce);
    _onlineDebounce = null;
  }
  _status = "idle";
  _pendingCount = 0;
  _failedCount = 0;
  _lastError = null;
  _syncInProgress = false;
  notify();
}
