import test from 'node:test';
import assert from 'node:assert/strict';

import {
  attendanceRate,
  daysBetween,
  evaluateStudentRules,
  shiftDay,
} from '../../src/server/care-rules.ts';

const AS_OF = '2026-11-08';

function rule(overrides = {}) {
  return {
    code: 'repeated_absence',
    ruleType: 'repeated_absence',
    threshold: 2,
    windowDays: 30,
    priority: 'high',
    isActive: true,
    ...overrides,
  };
}

function student(overrides = {}) {
  return {
    childId: 'child-1',
    enrolledAt: '2026-01-01',
    attendance: [],
    visitations: [],
    openFollowUp: null,
    ...overrides,
  };
}

test('attendanceRate counts present and late as attended', () => {
  assert.equal(attendanceRate([]), null);
  assert.equal(
    attendanceRate([
      { date: '2026-11-01', status: 'present' },
      { date: '2026-11-02', status: 'late' },
      { date: '2026-11-03', status: 'absent' },
      { date: '2026-11-04', status: 'excused' },
    ]),
    50,
  );
});

test('day helpers are timezone-safe and handle month/year boundaries', () => {
  assert.equal(shiftDay('2026-11-08', 30), '2026-12-08');
  assert.equal(shiftDay('2026-11-08', 60), '2027-01-07');
  assert.equal(shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-11-08', '2026-12-08'), 30);
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
});

test('repeated absence creates one explainable case at the threshold', () => {
  const results = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-11-01', status: 'absent' },
        { date: '2026-10-25', status: 'absent' },
        { date: '2026-10-18', status: 'present' },
      ],
    }),
    [rule()],
    AS_OF,
  );

  assert.equal(results.length, 1);
  const [alert] = results;
  assert.equal(alert.ruleType, 'repeated_absence');
  assert.equal(alert.action, 'create');
  assert.equal(alert.dedupeKey, 'rule:repeated_absence:child:child-1');
  assert.match(alert.reason, /2 مرة/);
  assert.match(alert.reason, /30/);
  assert.equal(alert.evidence.absences, 2);
  assert.equal(alert.evidence.threshold, 2);
  assert.equal(alert.suggestedDueDate, '2026-11-11');
  assert.doesNotMatch(alert.reason, /نفسي|سلوكي/);
});

test('repeated absence respects the inclusive window boundary', () => {
  const inside = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-10-10', status: 'absent' },
        { date: '2026-10-10', status: 'absent' },
        { date: '2026-10-09', status: 'absent' },
      ],
    }),
    [rule()],
    AS_OF,
  );
  assert.equal(inside.length, 1);
  assert.equal(inside[0].evidence.absences, 2);

  const outside = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-10-09', status: 'absent' },
        { date: '2026-10-08', status: 'absent' },
      ],
    }),
    [rule()],
    AS_OF,
  );
  assert.equal(outside.length, 0);
});

test('repeated absence stays quiet below the threshold and for inactive rules', () => {
  const below = evaluateStudentRules(
    student({ attendance: [{ date: '2026-11-01', status: 'absent' }] }),
    [rule()],
    AS_OF,
  );
  assert.equal(below.length, 0);

  const inactive = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-11-01', status: 'absent' },
        { date: '2026-10-25', status: 'absent' },
      ],
    }),
    [rule({ isActive: false })],
    AS_OF,
  );
  assert.equal(inactive.length, 0);
});

test('declining attendance compares equal windows and requires enough sessions', () => {
  const declining = student({
    attendance: [
      // recent window 2026-10-10 .. 2026-11-08: 1 of 3
      { date: '2026-11-01', status: 'present' },
      { date: '2026-10-20', status: 'absent' },
      { date: '2026-10-12', status: 'absent' },
      // previous window 2026-09-10 .. 2026-10-09: 3 of 3
      { date: '2026-10-05', status: 'present' },
      { date: '2026-09-28', status: 'present' },
      { date: '2026-09-15', status: 'late' },
    ],
  });

  const results = evaluateStudentRules(
    declining,
    [rule({ ruleType: 'declining_attendance', threshold: 20 })],
    AS_OF,
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].evidence.previousRate, 100);
  assert.equal(results[0].evidence.recentRate, 33.3);
  assert.equal(results[0].evidence.drop, 66.7);

  const insufficient = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-11-01', status: 'present' },
        { date: '2026-10-05', status: 'present' },
      ],
    }),
    [rule({ ruleType: 'declining_attendance', threshold: 20 })],
    AS_OF,
  );
  assert.equal(insufficient.length, 0);
});

test('overdue visitation handles overdue plans, recent visits and new students', () => {
  const overduePlan = evaluateStudentRules(
    student({
      visitations: [
        { date: '2026-11-05', status: 'completed' },
        { date: '2026-10-01', status: 'planned', followUpDate: '2026-11-01' },
      ],
    }),
    [rule({ ruleType: 'overdue_visitation', threshold: 45 })],
    AS_OF,
  );
  assert.equal(overduePlan.length, 1);
  assert.match(overduePlan[0].reason, /2026-11-01/);

  const staleCompletion = evaluateStudentRules(
    student({ visitations: [{ date: '2026-09-01', status: 'completed' }] }),
    [rule({ ruleType: 'overdue_visitation', threshold: 45 })],
    AS_OF,
  );
  assert.equal(staleCompletion.length, 1);
  assert.equal(staleCompletion[0].evidence.daysSinceVisit, 68);

  const recentCompletion = evaluateStudentRules(
    student({ visitations: [{ date: '2026-11-01', status: 'completed' }] }),
    [rule({ ruleType: 'overdue_visitation', threshold: 45 })],
    AS_OF,
  );
  assert.equal(recentCompletion.length, 0);

  const newStudent = evaluateStudentRules(
    student({ enrolledAt: '2026-09-01' }),
    [rule({ ruleType: 'overdue_visitation', threshold: 45 })],
    AS_OF,
  );
  assert.equal(newStudent.length, 1);
  assert.match(newStudent[0].reason, /لا يوجد افتقاد/);
});

test('pending follow-up produces a notification, not a duplicate case', () => {
  const overdue = evaluateStudentRules(
    student({
      openFollowUp: {
        id: 'fu-1',
        dueDate: '2026-11-01',
        lastActivityAt: '2026-11-06T10:00:00.000Z',
        createdAt: '2026-10-20T10:00:00.000Z',
      },
    }),
    [rule({ ruleType: 'pending_follow_up', code: 'pending_follow_up', threshold: 7 })],
    AS_OF,
  );
  assert.equal(overdue.length, 1);
  assert.equal(overdue[0].action, 'notify');
  assert.equal(overdue[0].followUpId, 'fu-1');
  assert.equal(
    overdue[0].dedupeKey,
    'rule:pending_follow_up:child:child-1:day:2026-11-08',
  );

  const idle = evaluateStudentRules(
    student({
      openFollowUp: {
        id: 'fu-2',
        dueDate: null,
        lastActivityAt: '2026-11-01T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    }),
    [rule({ ruleType: 'pending_follow_up', code: 'pending_follow_up', threshold: 7 })],
    AS_OF,
  );
  assert.equal(idle.length, 1);
  assert.equal(idle[0].evidence.idleDays, 7);

  const active = evaluateStudentRules(
    student({
      openFollowUp: {
        id: 'fu-3',
        dueDate: '2026-12-01',
        lastActivityAt: '2026-11-07T10:00:00.000Z',
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    }),
    [rule({ ruleType: 'pending_follow_up', code: 'pending_follow_up', threshold: 7 })],
    AS_OF,
  );
  assert.equal(active.length, 0);
});

test('one student can produce multiple independent rule results', () => {
  const results = evaluateStudentRules(
    student({
      attendance: [
        { date: '2026-11-01', status: 'absent' },
        { date: '2026-10-25', status: 'absent' },
      ],
      openFollowUp: {
        id: 'fu-1',
        dueDate: '2026-11-01',
        lastActivityAt: null,
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    }),
    [
      rule(),
      rule({ code: 'pending_follow_up', ruleType: 'pending_follow_up', threshold: 7 }),
    ],
    AS_OF,
  );
  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((item) => item.ruleType).sort(),
    ['pending_follow_up', 'repeated_absence'],
  );
});

test('dedupe keys are stable for the same child and open rule', () => {
  const first = evaluateStudentRules(
    student({ attendance: [{ date: '2026-11-01', status: 'absent' }, { date: '2026-10-25', status: 'absent' }] }),
    [rule()],
    AS_OF,
  );
  const second = evaluateStudentRules(
    student({ attendance: [{ date: '2026-11-01', status: 'absent' }, { date: '2026-10-25', status: 'absent' }] }),
    [rule()],
    '2026-11-09',
  );
  assert.equal(first[0].dedupeKey, second[0].dedupeKey);
});
