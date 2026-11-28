/**
 * Pure validation and deduplication helpers for offline attendance sync.
 * Framework-free so they can be unit-tested directly.
 */
import {
  ATTENDANCE_STATUSES,
  isIsoDate,
  isUuid,
  oneOf,
  optionalText,
  todayIso,
  type AttendanceStatus,
} from './validation';

export interface RawSyncOperation {
  operationId?: unknown;
  classId?: unknown;
  date?: unknown;
  childId?: unknown;
  status?: unknown;
  notes?: unknown;
  queuedAt?: unknown;
}

export interface ValidatedSyncOperation {
  operationId: string;
  classId: string;
  date: string;
  childId: string;
  status: AttendanceStatus;
  notes: string | null;
  queuedAt: number;
  seq: number;
}

export interface SyncOperationResult {
  operationId: string;
  outcome: 'applied' | 'duplicate' | 'rejected';
  retryable?: boolean;
  code?: string;
  message?: string;
}

export function validateSyncOperation(
  raw: RawSyncOperation,
  seq: number,
  maxDate: string = todayIso(),
): { ok: true; op: ValidatedSyncOperation } | { ok: false; operationId: string; code: string; message: string } {
  const operationId = typeof raw?.operationId === 'string' ? raw.operationId.trim() : '';
  if (!isUuid(operationId)) {
    return {
      ok: false,
      operationId: operationId || `invalid-${seq}`,
      code: 'INVALID_OPERATION_ID',
      message: 'معرّف العملية غير صالح',
    };
  }
  if (!isUuid(raw?.classId)) {
    return {
      ok: false,
      operationId,
      code: 'INVALID_CLASS_ID',
      message: 'معرّف الفصل غير صالح',
    };
  }
  if (!isIsoDate(raw?.date)) {
    return {
      ok: false,
      operationId,
      code: 'INVALID_DATE',
      message: 'التاريخ غير صالح',
    };
  }
  if (raw.date > maxDate) {
    return {
      ok: false,
      operationId,
      code: 'FUTURE_DATE',
      message: 'لا يمكن تسجيل حضور بتاريخ مستقبلي',
    };
  }
  if (!isUuid(raw?.childId)) {
    return {
      ok: false,
      operationId,
      code: 'INVALID_CHILD_ID',
      message: 'معرّف الطفل غير صالح',
    };
  }
  const status = oneOf(raw?.status, ATTENDANCE_STATUSES);
  if (!status) {
    return {
      ok: false,
      operationId,
      code: 'INVALID_STATUS',
      message: 'حالة حضور غير صالحة',
    };
  }

  const queuedAt =
    typeof raw?.queuedAt === 'number' && Number.isFinite(raw.queuedAt) ? raw.queuedAt : seq;

  return {
    ok: true,
    op: {
      operationId,
      classId: raw.classId,
      date: raw.date,
      childId: raw.childId,
      status,
      notes: optionalText(raw?.notes, 300),
      queuedAt,
      seq,
    },
  };
}

/**
 * Deduplicate identical operationIds within a single sync payload and sort
 * chronologically by (queuedAt, seq) so later offline edits win deterministically.
 */
export function prepareBatchOperations(
  ops: ValidatedSyncOperation[],
): { unique: ValidatedSyncOperation[]; inBatchDuplicates: string[] } {
  const seen = new Set<string>();
  const unique: ValidatedSyncOperation[] = [];
  const inBatchDuplicates: string[] = [];

  for (const op of ops) {
    const key = op.operationId.toLowerCase();
    if (seen.has(key)) {
      inBatchDuplicates.push(op.operationId);
      continue;
    }
    seen.add(key);
    unique.push(op);
  }

  unique.sort((a, b) => (a.queuedAt !== b.queuedAt ? a.queuedAt - b.queuedAt : a.seq - b.seq));
  return { unique, inBatchDuplicates };
}

/**
 * Collapse multiple distinct operations targeting the same (classId, date, childId)
 * into the latest status while preserving order. Ensures SQL ON CONFLICT never
 * touches the same target attendance row twice in one statement.
 */
export function latestByChildSession(
  ops: ValidatedSyncOperation[],
): ValidatedSyncOperation[] {
  const map = new Map<string, ValidatedSyncOperation>();
  for (const op of ops) {
    const key = `${op.classId}:${op.date}:${op.childId}`;
    map.set(key, op);
  }
  return Array.from(map.values());
}
