import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Deterministic auth/API harness for the locale + routing scenarios.
 *
 * The UI is exercised for real (server proxy, cookies, provider, direction),
 * while every `/api/**` response is mocked so the run never depends on a
 * production database, credentials, or seeded data.
 */
export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3105}`;

export const LOCALE_COOKIE = "ss_locale";
export const STORAGE_KEY = "sunday-school-locale";
export const SESSION_COOKIE = "ss_session";

export const TOKEN = "e2e-access-token";
export const REFRESHED_TOKEN = "e2e-refreshed-token";

export const USER = {
  id: "user-e2e",
  name: "Mina Samy",
  email: "mina@example.test",
  phone: "01000000000",
  role: "servant",
  servantRole: "خادم",
  grades: ["first"],
  classIds: ["class-1"],
  avatar: null,
};

export const CHURCH = { id: "church-e2e", slug: "e2e-church", name: "E2E Church" };

export const CLASSES = [
  {
    id: "class-1",
    name: "First Grade",
    grade: "first",
    academicYear: "2026",
    description: "Sunday class",
    image: null,
    isActive: true,
    sortOrder: 1,
    childrenCount: 14,
    servantsCount: 2,
  },
  {
    id: "class-2",
    name: "Second Grade",
    grade: "second",
    academicYear: "2026",
    description: null,
    image: null,
    isActive: true,
    sortOrder: 2,
    childrenCount: 12,
    servantsCount: 1,
  },
];

export const ANALYTICS = {
  filters: { from: "2026-10-15", to: "2026-11-13", classId: null },
  totals: {
    students: 42,
    activeClasses: 3,
    attendanceSessions: 8,
    childrenWithAttendance: 36,
    recordedRecords: 320,
    attendanceRate: 87.5,
  },
  distribution: { present: 260, absent: 30, late: 20, excused: 10, total: 320 },
  weekly: [
    { bucket: "2026-10-04", total: 40, present: 34, absent: 3, late: 2, excused: 1, rate: 85 },
    { bucket: "2026-10-11", total: 42, present: 37, absent: 2, late: 2, excused: 1, rate: 88.1 },
    { bucket: "2026-10-18", total: 38, present: 33, absent: 3, late: 1, excused: 1, rate: 86.8 },
    { bucket: "2026-10-25", total: 44, present: 39, absent: 2, late: 2, excused: 1, rate: 88.6 },
    { bucket: "2026-11-01", total: 41, present: 36, absent: 3, late: 1, excused: 1, rate: 87.8 },
    { bucket: "2026-11-08", total: 40, present: 35, absent: 2, late: 2, excused: 1, rate: 87.5 },
  ],
  monthly: [
    { bucket: "2026-09-01", total: 120, present: 100, absent: 10, late: 6, excused: 4, rate: 83.3 },
    { bucket: "2026-10-01", total: 160, present: 132, absent: 15, late: 8, excused: 5, rate: 82.5 },
    { bucket: "2026-11-01", total: 40, present: 35, absent: 2, late: 2, excused: 1, rate: 87.5 },
  ],
  classes: [
    {
      id: "class-1",
      name: "First Grade",
      grade: "first",
      students: 14,
      total: 110,
      present: 92,
      absent: 10,
      late: 5,
      excused: 3,
      openFollowUps: 2,
      rate: 83.6,
    },
    {
      id: "class-2",
      name: "Second Grade",
      grade: "second",
      students: 12,
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      openFollowUps: 0,
      rate: null,
    },
  ],
  followUps: {
    openCases: 6,
    inProgressCases: 3,
    overdueCases: 2,
    assignedCases: 8,
    unassignedCases: 1,
    resolvedInRange: 4,
    childrenWithOpenCases: 7,
    activitiesInRange: 12,
    workload: 9,
  },
};

export const FOLLOW_UPS = {
  data: [
    {
      id: "follow-up-1",
      childId: "child-1",
      classId: "class-1",
      servantId: null,
      ruleId: null,
      visitationId: null,
      status: "open",
      priority: "high",
      source: "manual",
      reason: "Attendance follow-up",
      dueDate: "2026-11-20",
      resolvedAt: null,
      resolutionNotes: null,
      createdAt: "2026-11-10T10:00:00.000Z",
      updatedAt: "2026-11-10T10:00:00.000Z",
      isOverdue: false,
      child: { id: "child-1", name: "Mark Adel" },
      class: { id: "class-1", name: "First Grade" },
      servant: null,
      activityCount: 0,
      lastActivityAt: null,
    },
  ],
  meta: {
    total: 1,
    page: 1,
    limit: 6,
    totalPages: 1,
    summary: { open: 6, inProgress: 3, overdue: 2, resolved: 4, total: 15 },
  },
};

export const NEWS = {
  data: [
    {
      id: "news-1",
      title: "Sunday gathering",
      content: "This week's Sunday gathering starts at 9 AM.",
      image: null,
      isPinned: false,
      authorName: "E2E Church",
      authorRole: "admin",
      author: null,
      createdAt: "2026-11-12T08:00:00.000Z",
      updatedAt: "2026-11-12T08:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 3,
  totalPages: 1,
};

export const NOTIFICATIONS = {
  data: [],
  meta: { total: 0, unread: 0, limit: 1 },
};

export const NOTIFICATION_PREFERENCES = {
  followUpAssigned: true,
  followUpOverdue: true,
  followUpCompleted: true,
  attendanceAlert: true,
};

type ApiMockOptions = {
  /** Return 401 for every authenticated data endpoint and for refresh. */
  expired?: boolean;
};

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

export async function installApiMocks(page: Page, options: ApiMockOptions = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/auth/login" || path === "/api/auth/register") {
      await route.fulfill(
        json({
          accessToken: TOKEN,
          user: USER,
          church: CHURCH,
          refreshToken: "e2e-refresh-token",
        }),
      );
      return;
    }

    if (path === "/api/auth/refresh") {
      await route.fulfill(
        options.expired
          ? json({ message: "Session expired" }, 401)
          : json({ accessToken: REFRESHED_TOKEN, user: USER, church: CHURCH }),
      );
      return;
    }

    if (path === "/api/auth/logout") {
      await route.fulfill(json({ message: "ok" }));
      return;
    }

    if (options.expired) {
      await route.fulfill(json({ message: "Session expired" }, 401));
      return;
    }

    if (path === "/api/analytics/overview") {
      await route.fulfill(json(ANALYTICS));
      return;
    }

    if (path === "/api/classes") {
      await route.fulfill(json(CLASSES));
      return;
    }

    if (path.startsWith("/api/classes/")) {
      await route.fulfill(json(CLASSES[0]));
      return;
    }

    if (path === "/api/follow-ups") {
      await route.fulfill(json(FOLLOW_UPS));
      return;
    }

    if (path === "/api/news") {
      await route.fulfill(json(NEWS));
      return;
    }

    if (path === "/api/notifications/preferences") {
      await route.fulfill(json(NOTIFICATION_PREFERENCES));
      return;
    }

    if (path === "/api/notifications") {
      await route.fulfill(json(method === "GET" ? NOTIFICATIONS : { message: "ok" }));
      return;
    }

    if (path === "/api/attendance/sessions") {
      await route.fulfill(json({ data: [], meta: { total: 0 } }));
      return;
    }

    if (path === "/api/auth/me") {
      await route.fulfill(json({ user: USER }));
      return;
    }

    await route.fulfill(json({}));
  });
}

export async function seedSession(context: BrowserContext) {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: "1",
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function seedLocalAuth(page: Page, token = TOKEN) {
  await page.addInitScript(
    ([tokenValue, user]) => {
      try {
        if (window.sessionStorage.getItem("__e2e_auth_seeded")) return;
        window.sessionStorage.setItem("__e2e_auth_seeded", "1");
        window.localStorage.setItem("ss_token", tokenValue);
        window.localStorage.setItem("ss_user", JSON.stringify(user));
      } catch {
        // Storage is best-effort; tests would fail loudly if it is unavailable.
      }
    },
    [token, USER] as const,
  );
}

/**
 * Switches the public language picker, then signs in through the real login
 * form with mocked credentials. The routing cookie is added after the login
 * page rendered (the proxy would otherwise bounce it to the dashboard).
 */
export async function signInFromLanding(
  page: Page,
  context: BrowserContext,
  locale: "ar" | "en",
) {
  await context.clearCookies();
  await page.goto("/");
  const picker = page.locator(".ps-languagePicker select");
  await picker.selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

  await page.locator(".ps-headerActions .ps-loginButton").click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);

  await seedSession(context);

  await page.locator("#identifier").fill("mina@example.test");
  await page.locator("#password").fill("password123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

/**
 * Samples the computed opacity of the first dashboard section from before
 * hydration. A normal-motion run must dip below 1 (it starts hidden); a
 * reduced-motion run must stay fully visible at every sample.
 */
export async function sampleMotion(page: Page) {
  await page.addInitScript(() => {
    const state = { min: 1, samples: 0 };
    (window as unknown as { __motionSample: typeof state }).__motionSample = state;
    const id = window.setInterval(() => {
      const element = document.querySelector("main section");
      if (!element) return;
      const opacity = Number.parseFloat(getComputedStyle(element).opacity);
      if (!Number.isFinite(opacity)) return;
      state.samples += 1;
      if (opacity < state.min) state.min = opacity;
    }, 16);
    window.addEventListener("pagehide", () => window.clearInterval(id));
  });
}
