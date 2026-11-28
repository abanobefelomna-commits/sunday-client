/**
 * Offline database layer — IndexedDB via a minimal typed wrapper (v2).
 *
 * Stores (all strictly scoped by `userId` for multi-user browser isolation):
 *  • `attendance_queue`  — attendance mutations waiting to be synced
 *  • `cached_classes`    — class list snapshot for offline display
 *  • `cached_children`   — children snapshot keyed by userId + id
 *  • `cached_attendance` — attendance map snapshot for (userId, classId, date, childId)
 *
 * Design rules:
 *  • No passwords, tokens, or admin credentials are stored here.
 *  • Only the minimum data needed for offline attendance recording is kept.
 *  • Every queue entry carries a stable `operationId` (UUID v4) so the server
 *    can detect and reject duplicate synchronisation attempts idempotently.
 *  • Every write awaits `tx.oncomplete` so reloads/logout never truncate writes.
 */

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type SyncState = "pending" | "syncing" | "synced" | "failed";

export interface QueuedAttendanceOp {
  /** Stable client-generated UUID — used for server-side idempotency. */
  operationId: string;
  /** Authenticated user ID that created this operation (isolation boundary). */
  userId: string;
  /** classId the record belongs to. */
  classId: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** childId that is being marked. */
  childId: string;
  /** The status being recorded. */
  status: AttendanceStatus;
  /** Client timestamp (ms since epoch) — used to order offline edits. */
  queuedAt: number;
  /** Current sync state. */
  syncState: SyncState;
  /** Number of sync attempts so far. */
  attempts: number;
  /** Whether a failed operation should be auto-retried on reconnect. */
  retryable?: boolean;
  /** Error message from the last failed attempt, if any. */
  lastError?: string;
}

export interface CachedClass {
  key?: string;
  userId?: string;
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  childrenCount?: number;
  cachedAt: number;
}

export interface CachedChild {
  key?: string;
  userId?: string;
  id: string;
  name: string;
  classId: string | null;
  className?: string;
  assignedServantName?: string;
  cachedAt: number;
}

export interface CachedAttendanceEntry {
  /** Composite key: `${userId}:${classId}:${date}:${childId}` */
  key: string;
  userId?: string;
  classId: string;
  date: string;
  childId: string;
  status: AttendanceStatus;
  cachedAt: number;
}

// ---------------------------------------------------------------------------
// DB bootstrap & schema migration
// ---------------------------------------------------------------------------

const DB_NAME = "sunday-school-offline";
const DB_VERSION = 2;
const ALL_STORES = [
  "attendance_queue",
  "cached_classes",
  "cached_children",
  "cached_attendance",
] as const;

let _db: IDBDatabase | null = null;
let _opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;

  _opening = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      // v1 -> v2 migration: recreate stores cleanly so unscoped pre-v2 data
      // cannot leak across user accounts.
      if (oldVersion > 0 && oldVersion < 2) {
        for (const name of ALL_STORES) {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
          }
        }
      }

      if (!db.objectStoreNames.contains("attendance_queue")) {
        const store = db.createObjectStore("attendance_queue", {
          keyPath: "operationId",
        });
        store.createIndex("userId", "userId");
        store.createIndex("syncState", "syncState");
        store.createIndex("userId_syncState", ["userId", "syncState"]);
        store.createIndex("userId_date", ["userId", "date"]);
        store.createIndex("userId_class_date_child", [
          "userId",
          "classId",
          "date",
          "childId",
        ]);
      }

      if (!db.objectStoreNames.contains("cached_classes")) {
        const store = db.createObjectStore("cached_classes", { keyPath: "key" });
        store.createIndex("userId", "userId");
      }

      if (!db.objectStoreNames.contains("cached_children")) {
        const store = db.createObjectStore("cached_children", { keyPath: "key" });
        store.createIndex("userId", "userId");
        store.createIndex("userId_classId", ["userId", "classId"]);
      }

      if (!db.objectStoreNames.contains("cached_attendance")) {
        const store = db.createObjectStore("cached_attendance", {
          keyPath: "key",
        });
        store.createIndex("userId", "userId");
        store.createIndex("userId_date", ["userId", "date"]);
        store.createIndex("userId_classId_date", ["userId", "classId", "date"]);
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
      };
      _opening = null;
      resolve(_db);
    };

    req.onerror = () => {
      _opening = null;
      reject(req.error);
    };

    req.onblocked = () => {
      _opening = null;
      reject(new Error("IndexedDB upgrade blocked"));
    };
  });

  return _opening;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction error"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

// ---------------------------------------------------------------------------
// Attendance queue
// ---------------------------------------------------------------------------

/**
 * Enqueue a new attendance mutation for `userId`.
 * If there is already an unsynced (`pending` or `failed`) operation for the
 * same (userId, classId, date, childId), replace it with the new operation so
 * toggling status offline produces a single clean pending mutation.
 */
export async function enqueueAttendance(
  op: Omit<QueuedAttendanceOp, "syncState" | "attempts" | "queuedAt" | "retryable">,
): Promise<void> {
  if (!op.userId) return;
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const index = store.index("userId_class_date_child");

  const existing = await idbRequest<QueuedAttendanceOp[]>(
    index.getAll([op.userId, op.classId, op.date, op.childId]),
  );

  for (const prev of existing) {
    if (prev.syncState === "pending" || prev.syncState === "failed") {
      store.delete(prev.operationId);
    }
  }

  const entry: QueuedAttendanceOp = {
    ...op,
    syncState: "pending",
    attempts: 0,
    retryable: true,
    queuedAt: Date.now(),
  };
  store.put(entry);
  await txComplete(tx);
}

/**
 * Remove any unsynced (`pending` or `failed`) operations for a child/date
 * when an online submission succeeds directly.
 */
export async function supersedePendingForChild(
  userId: string,
  classId: string,
  date: string,
  childId: string,
): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const index = store.index("userId_class_date_child");
  const existing = await idbRequest<QueuedAttendanceOp[]>(
    index.getAll([userId, classId, date, childId]),
  );
  for (const op of existing) {
    if (op.syncState === "pending" || op.syncState === "failed") {
      store.delete(op.operationId);
    }
  }
  await txComplete(tx);
}

/** Retrieve all operations for a user, optionally filtered by state. */
export async function getQueuedOps(
  userId: string,
  state?: SyncState,
): Promise<QueuedAttendanceOp[]> {
  if (!userId) return [];
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readonly");
  const store = tx.objectStore("attendance_queue");

  if (!state) {
    return idbRequest(store.index("userId").getAll(userId));
  }
  return idbRequest(store.index("userId_syncState").getAll([userId, state]));
}

/** Retrieve all unsynced operations (`pending`, `syncing`, `failed`) for a user. */
export async function getUnsyncedOps(userId: string): Promise<QueuedAttendanceOp[]> {
  const all = await getQueuedOps(userId);
  return all
    .filter((op) => op.syncState !== "synced")
    .sort((a, b) => a.queuedAt - b.queuedAt);
}

/**
 * Reset any operations stranded in `syncing` (e.g. after a page reload or crash
 * mid-request) back to `pending` so they are safely retried with the same UUID.
 */
export async function recoverStaleSyncingOps(userId: string): Promise<number> {
  if (!userId) return 0;
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const stale = await idbRequest<QueuedAttendanceOp[]>(
    store.index("userId_syncState").getAll([userId, "syncing"]),
  );
  for (const op of stale) {
    store.put({ ...op, syncState: "pending" });
  }
  await txComplete(tx);
  return stale.length;
}

/** Update a specific operation (e.g. after sync attempt). */
export async function updateQueuedOp(
  operationId: string,
  patch: Partial<Omit<QueuedAttendanceOp, "operationId">>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const existing = await idbRequest<QueuedAttendanceOp | undefined>(store.get(operationId));
  if (!existing) {
    await txComplete(tx);
    return;
  }
  store.put({ ...existing, ...patch });
  await txComplete(tx);
}

/** Remove a specific queued operation. */
export async function removeQueuedOp(operationId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  tx.objectStore("attendance_queue").delete(operationId);
  await txComplete(tx);
}

/** Remove all synced operations for a user (housekeeping). */
export async function purgeSyncedOps(userId: string): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const synced = await idbRequest<QueuedAttendanceOp[]>(
    store.index("userId_syncState").getAll([userId, "synced"]),
  );
  for (const op of synced) {
    store.delete(op.operationId);
  }
  await txComplete(tx);
}

/** Remove permanently rejected/failed operations when explicitly dismissed by user. */
export async function dismissFailedOps(userId: string): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("attendance_queue", "readwrite");
  const store = tx.objectStore("attendance_queue");
  const failed = await idbRequest<QueuedAttendanceOp[]>(
    store.index("userId_syncState").getAll([userId, "failed"]),
  );
  for (const op of failed) {
    store.delete(op.operationId);
  }
  await txComplete(tx);
}

/** Count unsynced operations (`pending` + `failed`) for a user. */
export async function pendingCount(userId: string): Promise<number> {
  const ops = await getUnsyncedOps(userId);
  return ops.length;
}

// ---------------------------------------------------------------------------
// Cache: classes
// ---------------------------------------------------------------------------

export async function cacheClasses(
  userId: string,
  classes: Array<Omit<CachedClass, "key" | "userId" | "cachedAt"> & { cachedAt?: number }>,
): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("cached_classes", "readwrite");
  const store = tx.objectStore("cached_classes");
  const existingKeys = await idbRequest<IDBValidKey[]>(
    store.index("userId").getAllKeys(userId),
  );
  for (const k of existingKeys) {
    store.delete(k);
  }
  const now = Date.now();
  for (const cls of classes) {
    store.put({
      ...cls,
      userId,
      key: `${userId}:${cls.id}`,
      cachedAt: now,
    });
  }
  await txComplete(tx);
}

export async function getCachedClasses(userId: string): Promise<CachedClass[]> {
  if (!userId) return [];
  const db = await openDb();
  const tx = db.transaction("cached_classes", "readonly");
  const store = tx.objectStore("cached_classes");
  return idbRequest(store.index("userId").getAll(userId));
}

// ---------------------------------------------------------------------------
// Cache: children
// ---------------------------------------------------------------------------

export async function cacheChildren(
  userId: string,
  children: Array<Omit<CachedChild, "key" | "userId" | "cachedAt"> & { cachedAt?: number }>,
  scopedClassId?: string,
): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("cached_children", "readwrite");
  const store = tx.objectStore("cached_children");

  const existingKeys = scopedClassId
    ? await idbRequest<IDBValidKey[]>(
        store.index("userId_classId").getAllKeys([userId, scopedClassId]),
      )
    : await idbRequest<IDBValidKey[]>(store.index("userId").getAllKeys(userId));

  for (const k of existingKeys) {
    store.delete(k);
  }

  const now = Date.now();
  for (const child of children) {
    store.put({
      ...child,
      userId,
      key: `${userId}:${child.id}`,
      cachedAt: now,
    });
  }
  await txComplete(tx);
}

export async function getCachedChildren(
  userId: string,
  classId?: string,
): Promise<CachedChild[]> {
  if (!userId) return [];
  const db = await openDb();
  const tx = db.transaction("cached_children", "readonly");
  const store = tx.objectStore("cached_children");

  if (classId) {
    return idbRequest(store.index("userId_classId").getAll([userId, classId]));
  }
  return idbRequest(store.index("userId").getAll(userId));
}

// ---------------------------------------------------------------------------
// Cache: attendance
// ---------------------------------------------------------------------------

export async function cacheAttendance(
  userId: string,
  entries: Array<Omit<CachedAttendanceEntry, "key" | "userId" | "cachedAt"> & { cachedAt?: number }>,
  scope?: { date: string; classId?: string },
): Promise<void> {
  if (!userId) return;
  const db = await openDb();
  const tx = db.transaction("cached_attendance", "readwrite");
  const store = tx.objectStore("cached_attendance");

  if (scope) {
    const existingKeys = scope.classId
      ? await idbRequest<IDBValidKey[]>(
          store.index("userId_classId_date").getAllKeys([userId, scope.classId, scope.date]),
        )
      : await idbRequest<IDBValidKey[]>(
          store.index("userId_date").getAllKeys([userId, scope.date]),
        );
    for (const k of existingKeys) {
      store.delete(k);
    }
  }

  const now = Date.now();
  for (const entry of entries) {
    store.put({
      ...entry,
      userId,
      key: `${userId}:${entry.classId}:${entry.date}:${entry.childId}`,
      cachedAt: now,
    });
  }
  await txComplete(tx);
}

export async function getCachedAttendance(
  userId: string,
  date: string,
  classId?: string,
): Promise<CachedAttendanceEntry[]> {
  if (!userId) return [];
  const db = await openDb();
  const tx = db.transaction("cached_attendance", "readonly");
  const store = tx.objectStore("cached_attendance");

  if (classId) {
    return idbRequest(store.index("userId_classId_date").getAll([userId, classId, date]));
  }
  return idbRequest(store.index("userId_date").getAll([userId, date]));
}

// ---------------------------------------------------------------------------
// Clear data (logout / user switch)
// ---------------------------------------------------------------------------

export async function clearOfflineData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const stores = [...ALL_STORES];
  const tx = db.transaction(stores, "readwrite");
  for (const name of stores) {
    tx.objectStore(name).clear();
  }
  await txComplete(tx);
}

export async function clearUserOfflineData(userId: string): Promise<void> {
  if (!userId || typeof indexedDB === "undefined") return;
  const db = await openDb();
  const stores = [...ALL_STORES];
  const tx = db.transaction(stores, "readwrite");
  for (const name of stores) {
    const store = tx.objectStore(name);
    const keys = await idbRequest<IDBValidKey[]>(store.index("userId").getAllKeys(userId));
    for (const key of keys) {
      store.delete(key);
    }
  }
  await txComplete(tx);
}
