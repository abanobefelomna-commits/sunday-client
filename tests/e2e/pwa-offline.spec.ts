import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  CHILDREN,
  CLASSES,
  LOCALE_COOKIE,
  TOKEN,
  USER,
  installApiMocks,
  seedLocalAuth,
  seedSession,
} from "./support";

const USER_B = {
  ...USER,
  id: "user-b-e2e",
  name: "Mariam Nabil",
  email: "mariam@example.test",
  classIds: ["class-2"],
};

const USER_B_CLASSES = [CLASSES[1]];
const USER_B_CHILDREN = {
  data: [
    {
      ...CHILDREN.data[0],
      id: "child-b-1",
      name: "Bishoy Wagih",
      classId: "class-2",
      class: { id: "class-2", name: "Second Grade", grade: "second" },
    },
  ],
  total: 1,
};

test.describe("PWA + Offline Attendance", () => {
  test("manifest, icons, service worker, and offline fallback work", async ({ page, context }) => {
    await installApiMocks(page);

    const manifestRes = await context.request.get(`${BASE_URL}/manifest.webmanifest`);
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

    for (const iconPath of [
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/maskable-512.png",
      "/icons/apple-touch-icon.png",
      "/icons/favicon-32.png",
    ]) {
      const res = await context.request.get(`${BASE_URL}${iconPath}`);
      expect(res.status(), iconPath).toBe(200);
    }

    const swRes = await context.request.get(`${BASE_URL}/sw.js`);
    expect(swRes.status()).toBe(200);
    expect(swRes.headers()["cache-control"]).toContain("no-cache");

    // Verify /offline page renders in English
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Attendance" })).toBeVisible();

    // Verify /offline page renders in Arabic
    await context.addCookies([{ name: LOCALE_COOKIE, value: "ar", url: BASE_URL }]);
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "لا يوجد اتصال بالإنترنت" })).toBeVisible();
  });

  test("online load -> offline mark -> reload offline -> reconnect auto-sync -> idempotent", async ({
    page,
    context,
  }) => {
    const syncCalls: Array<{
      operations: Array<{
        operationId: string;
        classId: string;
        date: string;
        childId: string;
        status: string;
      }>;
    }> = [];
    let attendanceRows: Array<{
      id: string;
      childId: string;
      classId: string;
      date: string;
      status: string;
    }> = [];

    await installApiMocks(page);
    await page.route("**/api/children*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CHILDREN),
      });
    });
    await page.route("**/api/attendance?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(attendanceRows),
      });
    });
    await page.route("**/api/attendance/sync", async (route) => {
      const payload = route.request().postDataJSON();
      syncCalls.push(payload);
      const results = (payload.operations || []).map(
        (op: { operationId: string; childId: string; classId: string; date: string; status: string }) => {
          attendanceRows = [
            ...attendanceRows.filter((r) => !(r.childId === op.childId && r.date === op.date)),
            {
              id: `att-${op.childId}`,
              childId: op.childId,
              classId: op.classId,
              date: op.date,
              status: op.status,
            },
          ];
          return { operationId: op.operationId, outcome: "applied" };
        },
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results,
          applied: results.length,
          duplicates: 0,
          rejected: 0,
          alerts: 0,
        }),
      });
    });

    await seedSession(context);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await seedLocalAuth(page);

    // 1. Load attendance page online so SW caches page & IDB caches classes/children
    await page.goto("/attendance");
    await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();

    // Wait for service worker to become active & controlling
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    // Reload once online so the SW controller controls the page before going offline
    await page.reload();
    await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();

    // 2. Go offline
    await context.setOffline(true);
    await expect(page.getByTestId("online-status-bar")).toContainText(
      "No connection — changes saved offline",
    );

    // 3. Mark first child as Present while offline
    const childGroup = page.getByRole("group", {
      name: `Attendance for ${CHILDREN.data[0].name}`,
    });
    await childGroup.getByRole("button", { name: "Present" }).click();

    await expect(page.getByText("Saved locally offline — pending sync")).toBeVisible();
    await expect(page.getByText("Pending sync", { exact: true })).toBeVisible();
    await expect(page.getByTestId("online-status-bar")).toContainText("1 changes waiting to sync");

    // 4. Reload while STILL OFFLINE — cached list + local pending status must survive!
    await page.reload();
    await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();
    await expect(page.getByText("Pending sync", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("group", { name: `Attendance for ${CHILDREN.data[0].name}` })
        .getByRole("button", { name: "Present" }),
    ).toHaveAttribute("aria-pressed", "true");

    // 5. Return online — automatic sync must trigger with a valid UUID operationId
    await context.setOffline(false);

    await expect.poll(() => syncCalls.length, { timeout: 10_000 }).toBe(1);
    const sentOp = syncCalls[0].operations[0];
    expect(sentOp.childId).toBe("child-1");
    expect(sentOp.classId).toBe("class-1");
    expect(sentOp.status).toBe("present");
    expect(sentOp.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Pending badge disappears after sync completes
    await expect(page.getByText("Pending sync", { exact: true })).toHaveCount(0);
  });

  test("failed sync keeps operation queued and retries on Retry click", async ({
    page,
    context,
  }) => {
    let attempt = 0;
    const seenOpIds: string[] = [];

    await installApiMocks(page);
    await page.route("**/api/children*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CHILDREN),
      });
    });
    await page.route("**/api/attendance?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/attendance/sync", async (route) => {
      attempt += 1;
      const payload = route.request().postDataJSON();
      for (const op of payload.operations || []) {
        seenOpIds.push(op.operationId);
      }
      if (attempt === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Temporary database outage" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: (payload.operations || []).map((op: { operationId: string }) => ({
            operationId: op.operationId,
            outcome: "applied",
          })),
          applied: payload.operations.length,
          duplicates: 0,
          rejected: 0,
          alerts: 0,
        }),
      });
    });

    await seedSession(context);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await seedLocalAuth(page);

    await page.goto("/attendance");
    await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();

    await context.setOffline(true);
    await page
      .getByRole("group", { name: `Attendance for ${CHILDREN.data[0].name}` })
      .getByRole("button", { name: "Absent" })
      .click();
    await expect(page.getByText("Pending sync", { exact: true })).toBeVisible();

    // Reconnect: first sync fails with 500 -> operation must stay queued & show Retry
    await context.setOffline(false);
    await expect.poll(() => attempt, { timeout: 10_000 }).toBe(1);
    await expect(page.getByTestId("online-status-bar")).toContainText("Sync failed — tap to retry");
    await expect(page.getByText("Sync failed", { exact: true }).first()).toBeVisible();

    // Click Retry -> succeeds with the EXACT same operationId UUID!
    await page.getByTestId("online-status-bar").getByRole("button", { name: "Retry" }).click();
    await expect.poll(() => attempt, { timeout: 10_000 }).toBe(2);
    expect(seenOpIds[0]).toBe(seenOpIds[1]);
    await expect(page.getByText("Pending sync", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Sync failed", { exact: true })).toHaveCount(0);
  });

  test("logout isolates offline data between User A and User B on the same browser", async ({
    page,
    context,
  }) => {
    let activeUser = USER;
    const syncCalls: unknown[] = [];

    await installApiMocks(page);
    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.email === USER_B.email) {
        activeUser = USER_B;
      } else {
        activeUser = USER;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: TOKEN,
          user: activeUser,
          church: { id: "church-e2e", slug: "e2e-church", name: "E2E Church" },
        }),
      });
    });
    await page.route("**/api/classes*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeUser.id === USER_B.id ? USER_B_CLASSES : CLASSES),
      });
    });
    await page.route("**/api/children*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeUser.id === USER_B.id ? USER_B_CHILDREN : CHILDREN),
      });
    });
    await page.route("**/api/attendance?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
    await page.route("**/api/attendance/sync", async (route) => {
      syncCalls.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], applied: 0, duplicates: 0, rejected: 0, alerts: 0 }),
      });
    });

    await seedSession(context);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await seedLocalAuth(page);

    // User A visits /attendance, goes offline, queues an attendance op
    await page.goto("/attendance");
    await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();

    await context.setOffline(true);
    await page
      .getByRole("group", { name: `Attendance for ${CHILDREN.data[0].name}` })
      .getByRole("button", { name: "Present" })
      .click();
    await expect(page.getByText("Pending sync", { exact: true })).toBeVisible();

    // Bring back online to log out (without hitting sync — mock intercepts or logout first!)
    // Actually pause sync by testing logout while offline/immediate click:
    // Let's block /api/attendance/sync during the moment we toggle online, or click logout directly
    // (Note: AppHeader logout navigates to /logout which needs network, so let's keep sync failing/slow or go online and click logout immediately)
    await page.getByRole("button", { name: "Account" }).click();
    await context.setOffline(false);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL((url) => url.pathname === "/" && !url.search);

    // Login as User B
    await page.locator(".ps-headerActions .ps-loginButton").click();
    await expect(page).toHaveURL(/\/login/);
    await seedSession(context);
    await page.locator("#identifier").fill(USER_B.email);
    await page.locator("#password").fill("password123");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);

    // Clear syncCalls from User A before checking User B
    const callsBeforeUserB = syncCalls.length;
    await page.goto("/attendance");
    await expect(page.getByText("Bishoy Wagih")).toBeVisible();
    await expect(page.getByText(CHILDREN.data[0].name)).toHaveCount(0);
    await expect(page.getByText("Pending sync", { exact: true })).toHaveCount(0);
    expect(syncCalls.length).toBe(callsBeforeUserB);
  });

  test("attendance page is responsive on mobile Arabic RTL and English LTR without overflow", async ({
    browser,
  }) => {
    for (const locale of ["ar", "en"] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await installApiMocks(page);
      await page.route("**/api/children*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(CHILDREN),
        });
      });
      await page.route("**/api/attendance?*", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      });
      await seedSession(context);
      await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url: BASE_URL }]);
      await seedLocalAuth(page);

      await page.goto(`${BASE_URL}/attendance`);
      await expect(page.getByText(CHILDREN.data[0].name)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

      await context.setOffline(true);
      await expect(page.getByTestId("online-status-bar")).toContainText(
        locale === "ar"
          ? "لا يوجد اتصال — التغييرات محفوظة محليًا"
          : "No connection — changes saved offline",
      );

      // Verify no hardcoded Arabic "دون اتصال" leaks in English mode
      if (locale === "en") {
        await expect(page.locator("main")).not.toContainText("دون اتصال");
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);

      await context.close();
    }
  });
});
