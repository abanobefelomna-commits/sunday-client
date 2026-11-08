/**
 * Explainable follow-up rule engine.
 *
 * Rules only use recorded measurable events: attendance rows, visitation rows
 * and configured thresholds. No psychological or behavioural classification is
 * produced or stored here.
 */

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type VisitationStatus = 'planned' | 'completed' | 'cancelled';

export interface AttendanceEvent {
  date: string;
  status: AttendanceStatus;
}

export interface VisitationEvent {
  date: string;
  status: VisitationStatus;
  followUpDate?: string | null;
}

export interface RuleConfig {
  id?: string;
  code: string;
  name?: string;
  ruleType: 'repeated_absence' | 'declining_attendance' | 'overdue_visitation' | 'pending_follow_up';
  threshold: number;
  windowDays: number;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
}

export interface StudentRuleInput {
  childId: string;
  enrolledAt: string;
  attendance: AttendanceEvent[];
  visitations: VisitationEvent[];
  openFollowUp?: {
    id: string;
    dueDate?: string | null;
    lastActivityAt?: string | null;
    createdAt: string;
  } | null;
}

export interface AppliedRule {
  ruleCode: string;
  ruleType: RuleConfig['ruleType'];
  priority: RuleConfig['priority'];
  action: 'create' | 'notify';
  reason: string;
  dedupeKey: string;
  evidence: Record<string, number | string | null>;
  suggestedDueDate: string;
  followUpId?: string;
}

const DAY = 86_400_000;

export function toDay(value: string): number {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
}

export function daysBetween(from: string, to: string): number {
  return Math.floor((toDay(to) - toDay(from)) / DAY);
}

export function shiftDay(isoDate: string, days: number): string {
  return new Date(toDay(isoDate) + days * DAY).toISOString().slice(0, 10);
}

export function attendanceRate(events: AttendanceEvent[]): number | null {
  if (events.length === 0) return null;
  const attended = events.filter((event) => event.status === 'present' || event.status === 'late').length;
  return Math.round((attended / events.length) * 1000) / 10;
}

function inWindow(events: AttendanceEvent[], from: string, to: string): AttendanceEvent[] {
  return events.filter((event) => {
    const day = event.date.slice(0, 10);
    return day >= from && day <= to;
  });
}

/**
 * Evaluate all active rules for one student as of `asOf` (YYYY-MM-DD).
 * Results are deterministic and explainable; dedupeKey is stable while a case
 * stays open, which lets the caller avoid duplicate cases.
 */
export function evaluateStudentRules(
  student: StudentRuleInput,
  rules: RuleConfig[],
  asOf: string,
): AppliedRule[] {
  const results: AppliedRule[] = [];

  for (const rule of rules) {
    if (!rule.isActive) continue;

    switch (rule.ruleType) {
      case 'repeated_absence': {
        const windowStart = shiftDay(asOf, -(rule.windowDays - 1));
        const recent = inWindow(student.attendance, windowStart, asOf);
        const absences = recent.filter((event) => event.status === 'absent').length;
        if (absences >= rule.threshold && absences > 0) {
          results.push({
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            priority: rule.priority,
            action: 'create',
            reason: `تكرر الغياب ${absences} مرة خلال آخر ${rule.windowDays} يومًا (الحد المفعّل: ${rule.threshold}).`,
            dedupeKey: `rule:${rule.code}:child:${student.childId}`,
            evidence: { absences, windowDays: rule.windowDays, threshold: rule.threshold },
            suggestedDueDate: shiftDay(asOf, 3),
          });
        }
        break;
      }

      case 'declining_attendance': {
        const recentStart = shiftDay(asOf, -(rule.windowDays - 1));
        const previousEnd = shiftDay(recentStart, -1);
        const previousStart = shiftDay(previousEnd, -(rule.windowDays - 1));
        const recent = inWindow(student.attendance, recentStart, asOf);
        const previous = inWindow(student.attendance, previousStart, previousEnd);
        const recentRate = attendanceRate(recent);
        const previousRate = attendanceRate(previous);

        if (recentRate !== null && previousRate !== null && recent.length >= 3 && previous.length >= 3) {
          const drop = Math.round((previousRate - recentRate) * 10) / 10;
          if (drop >= rule.threshold && recentRate < 85) {
            results.push({
              ruleCode: rule.code,
              ruleType: rule.ruleType,
              priority: rule.priority,
              action: 'create',
              reason: `انخفضت نسبة الحضور ${drop} نقطة مئوية مقارنة بالفترة السابقة (${previousRate}% ← ${recentRate}%، الحد المفعّل: ${rule.threshold}).`,
              dedupeKey: `rule:${rule.code}:child:${student.childId}`,
              evidence: {
                previousRate,
                recentRate,
                drop,
                threshold: rule.threshold,
                recentSessions: recent.length,
                previousSessions: previous.length,
              },
              suggestedDueDate: shiftDay(asOf, 5),
            });
          }
        }
        break;
      }

      case 'overdue_visitation': {
        const completed = student.visitations
          .filter((visit) => visit.status === 'completed')
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        const lastCompleted = completed[0]?.date ?? null;

        const overduePlanned = student.visitations
          .filter(
            (visit) =>
              visit.status === 'planned' &&
              !!visit.followUpDate &&
              visit.followUpDate.slice(0, 10) < asOf,
          )
          .sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : 1))[0];

        if (overduePlanned) {
          results.push({
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            priority: rule.priority,
            action: 'create',
            reason: `يوجد افتقاد مجدول بتاريخ ${overduePlanned.followUpDate} ولم يُكتمل حتى ${asOf}.`,
            dedupeKey: `rule:${rule.code}:child:${student.childId}`,
            evidence: { plannedDate: overduePlanned.followUpDate ?? null, lastCompleted },
            suggestedDueDate: shiftDay(asOf, 2),
          });
          break;
        }

        if (lastCompleted) {
          const elapsed = daysBetween(lastCompleted, asOf);
          if (elapsed >= rule.threshold) {
            results.push({
              ruleCode: rule.code,
              ruleType: rule.ruleType,
              priority: rule.priority,
              action: 'create',
              reason: `مر ${elapsed} يومًا منذ آخر افتقاد مكتمل (الحد المفعّل: ${rule.threshold} يومًا).`,
              dedupeKey: `rule:${rule.code}:child:${student.childId}`,
              evidence: { daysSinceVisit: elapsed, threshold: rule.threshold, lastCompleted },
              suggestedDueDate: shiftDay(asOf, 3),
            });
          }
        } else {
          const enrolledFor = daysBetween(student.enrolledAt.slice(0, 10), asOf);
          if (enrolledFor >= rule.threshold) {
            results.push({
              ruleCode: rule.code,
              ruleType: rule.ruleType,
              priority: rule.priority,
              action: 'create',
              reason: `لا يوجد افتقاد مكتمل مسجّل، ومر ${enrolledFor} يومًا منذ التسجيل (الحد المفعّل: ${rule.threshold} يومًا).`,
              dedupeKey: `rule:${rule.code}:child:${student.childId}`,
              evidence: { daysSinceEnrollment: enrolledFor, threshold: rule.threshold, lastCompleted: null },
              suggestedDueDate: shiftDay(asOf, 3),
            });
          }
        }
        break;
      }

      case 'pending_follow_up': {
        const open = student.openFollowUp;
        if (!open) break;
        const reference = open.lastActivityAt?.slice(0, 10) || open.createdAt.slice(0, 10);
        const idleDays = daysBetween(reference, asOf);
        const overdue = !!open.dueDate && open.dueDate.slice(0, 10) < asOf;

        if (overdue || idleDays >= rule.threshold) {
          results.push({
            ruleCode: rule.code,
            ruleType: rule.ruleType,
            priority: rule.priority,
            action: 'notify',
            reason: overdue
              ? `المتابعة المفتوحة تجاوزت موعد الاستحقاق (${open.dueDate}) بدون إغلاق.`
              : `المتابعة المفتوحة بلا نشاط منذ ${idleDays} يومًا (الحد المفعّل: ${rule.threshold}).`,
            dedupeKey: `rule:${rule.code}:child:${student.childId}:day:${asOf}`,
            evidence: { idleDays, threshold: rule.threshold, dueDate: open.dueDate ?? null },
            suggestedDueDate: shiftDay(asOf, 1),
            followUpId: open.id,
          });
        }
        break;
      }
    }
  }

  return results;
}
