import { query, queryOne } from '../db.ts';
import { readScopeClassIds, type AccessContext } from '../access.ts';

interface ClassRow {
  id: string;
  name: string;
  grade: string | null;
  academicYear: string | null;
  leaderName: string | null;
  childrenCount: number;
}

interface ChildRow {
  name: string;
  birthDate: string | Date | null;
  className: string;
  position: number;
}

interface AttendanceRow {
  className: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  absentChildren: number;
}

const CHILD_LIST_LIMIT = 200;

function ageFromBirthDate(value: ChildRow['birthDate']): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** Churches can switch child names off for the assistant (ai.shareChildNames = false). */
async function shareChildNames(): Promise<boolean> {
  try {
    const row = await queryOne<{ value: unknown }>(
      `SELECT "value" FROM "church_settings" WHERE "key" = 'ai.shareChildNames' LIMIT 1`,
    );
    const v = row?.value;
    if (v === false) return false;
    if (typeof v === 'string' && v.trim().toLowerCase() === 'false') return false;
    if (v && typeof v === 'object' && (v as { enabled?: unknown }).enabled === false) return false;
  } catch {
    // Setting is optional; default is to share first names only.
  }
  return true;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

async function readChurchName(): Promise<string> {
  try {
    const row = await queryOne<{ value: unknown }>(
      `SELECT "value" FROM "church_settings" WHERE "key" = 'site.name' LIMIT 1`,
    );
    const value = row?.value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && 'name' in value) {
      const name = (value as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
  } catch {
    // Settings are optional; keep the generic label.
  }
  return 'الكنيسة';
}

/**
 * Build a read-only snapshot of the church data this user is allowed to see.
 *
 * Privileged users (admin / priest / مسؤول / أب كاهن) receive every class and
 * child. A servant receives only the classes assigned to them, unless the
 * church explicitly enabled the legacy broad-read setting. Contact details are
 * never included — the assistant only needs names, ages, class counts, and
 * aggregate attendance.
 */
export async function buildAiDataContext(access: AccessContext): Promise<string> {
  const scope = readScopeClassIds(access);
  const broad = scope === null;
  const classIds = scope ?? [];
  const churchName = await readChurchName();
  const withNames = await shareChildNames();

  if (!broad && classIds.length === 0) {
    return [
      '## بيانات الكنيسة المتاحة لك الآن',
      `- الكنيسة: ${churchName}`,
      '- نطاق الوصول: لا يوجد فصل مرتبط بحسابك بعد.',
      '- لا تتوفر بيانات أطفال لهذا الحساب. اطلب من المسؤول ربط حسابك بالفصل قبل طلب أي إحصائيات.',
    ].join('\n');
  }

  const classes = await query<ClassRow>(
    `SELECT cl."id",
            cl."name",
            cl."grade"::text AS "grade",
            cl."academicYear",
            lead."name" AS "leaderName",
            (SELECT count(*)::int
             FROM "children" ch
             WHERE ch."classId" = cl."id" AND ch."deletedAt" IS NULL) AS "childrenCount"
     FROM "classes" cl
     LEFT JOIN "servants" lead ON lead."id" = cl."leadServantId"
     WHERE cl."isActive" = true
       AND ($1::boolean = true OR cl."id" = ANY($2::uuid[]))
     ORDER BY cl."sortOrder", cl."name"`,
    [broad, classIds],
  );

  const children = await query<ChildRow>(
    `SELECT ch."name",
            ch."birthDate",
            cl."name" AS "className",
            row_number() OVER (PARTITION BY cl."id" ORDER BY ch."name") AS "position"
     FROM "children" ch
     JOIN "classes" cl ON cl."id" = ch."classId"
     WHERE ch."deletedAt" IS NULL
       AND ($1::boolean = true OR ch."classId" = ANY($2::uuid[]))
     ORDER BY cl."sortOrder", cl."name", ch."name"
     LIMIT ${CHILD_LIST_LIMIT}`,
    [broad, classIds],
  );

  const totalChildren = classes.reduce((sum, item) => sum + Number(item.childrenCount || 0), 0);

  let attendance: AttendanceRow[] = [];
  try {
    attendance = await query<AttendanceRow>(
      `SELECT cl."name" AS "className",
              count(*)::int AS "total",
              count(*) FILTER (WHERE a."status" = 'present')::int AS "present",
              count(*) FILTER (WHERE a."status" = 'absent')::int AS "absent",
              count(*) FILTER (WHERE a."status" = 'late')::int AS "late",
              count(*) FILTER (WHERE a."status" = 'excused')::int AS "excused",
              count(DISTINCT a."childId") FILTER (WHERE a."status" = 'absent')::int AS "absentChildren"
       FROM "attendance" a
       JOIN "classes" cl ON cl."id" = a."classId"
       WHERE a."date" >= current_date - interval '28 days'
         AND ($1::boolean = true OR a."classId" = ANY($2::uuid[]))
       GROUP BY cl."id", cl."name", cl."sortOrder"
       ORDER BY cl."sortOrder"`,
      [broad, classIds],
    );
  } catch {
    // Older tenants may not have attendance sessions yet; the class and child
    // snapshot is still useful without the aggregate.
  }

  const lines: string[] = [
    '## بيانات الكنيسة المتاحة لك الآن (للقراءة فقط)',
    `- الكنيسة: ${churchName}`,
    broad
      ? '- نطاق وصولك: المسؤول/الكاهن — كل الفصول وكل الأطفال.'
      : '- نطاق وصولك: خادم — الفصل أو الفصول المرتبطة بحسابك فقط.',
    `- إجمالي الأطفال في نطاقك: ${totalChildren}`,
    '',
    '### الفصول',
    '| الفصل | الصف | عدد الأطفال | قائد الفصل |',
    '| --- | --- | --- | --- |',
  ];

  if (classes.length === 0) {
    lines.push('| لا توجد فصول متاحة | - | 0 | - |');
  } else {
    for (const item of classes) {
      lines.push(
        `| ${item.name} | ${item.grade || '-'} | ${item.childrenCount} | ${item.leaderName || '-'} |`,
      );
    }
  }

  if (!withNames) {
    lines.push('', '### قائمة الأطفال', 'أسماء الأطفال غير مشاركة مع المساعد في إعدادات هذه الكنيسة. تتوفر الأعداد والإحصائيات فقط.');
  } else {
    lines.push('', `### قائمة الأطفال — الاسم الأول فقط (${children.length}${totalChildren > children.length ? ` من أصل ${totalChildren}` : ''})`);
  }

  if (!withNames) {
    // names intentionally omitted
  } else if (children.length === 0) {
    lines.push('لا يوجد أطفال مسجلون في نطاق وصولك.');
  } else {
    let currentClass = '';
    for (const child of children) {
      if (child.className !== currentClass) {
        currentClass = child.className;
        lines.push('', `#### ${currentClass}`);
      }
      const age = ageFromBirthDate(child.birthDate);
      lines.push(`${Number(child.position)}. ${firstName(child.name)}${age !== null ? ` — العمر: ${age}` : ''}`);
    }
    if (withNames && totalChildren > children.length) {
      lines.push(
        '',
        `ملاحظة: القائمة تعرض أول ${children.length} طفل فقط. اسأل عن فصل محدد للحصول على تفاصيل أدق.`,
      );
    }
  }

  if (attendance.length > 0) {
    lines.push(
      '',
      '### الحضور خلال آخر 28 يومًا',
      '| الفصل | إجمالي السجلات | حاضر | غائب | متأخر | بعذر | أطفال تغيبوا |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const row of attendance) {
      lines.push(
        `| ${row.className} | ${row.total} | ${row.present} | ${row.absent} | ${row.late} | ${row.excused} | ${row.absentChildren} |`,
      );
    }
  }

  return lines.join('\n');
}
