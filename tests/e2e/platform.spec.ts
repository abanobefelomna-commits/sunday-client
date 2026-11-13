import { expect, test, type BrowserContext } from "@playwright/test";
import {
  ANALYTICS,
  BASE_URL,
  LOCALE_COOKIE,
  REFRESHED_TOKEN,
  SESSION_COOKIE,
  STORAGE_KEY,
  TOKEN,
  installApiMocks,
  sampleMotion,
  seedLocalAuth,
  seedSession,
  signInFromLanding,
} from "./support";

const AUTHENTICATED_APP_PATHS = [
  "/analytics",
  "/attendance",
  "/children",
  "/children/e2e-child",
  "/classes",
  "/classes/e2e-class",
  "/dashboard",
  "/follow-ups",
  "/follow-ups/e2e-follow-up",
  "/friday-prep",
  "/news",
  "/notifications",
  "/profile",
  "/servants",
];

async function expectLocaleAcrossAppRoutes(
  context: BrowserContext,
  locale: "ar" | "en",
) {
  const direction = locale === "ar" ? "rtl" : "ltr";

  for (const path of AUTHENTICATED_APP_PATHS) {
    const response = await context.request.get(`${BASE_URL}${path}`);
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toContain(`lang="${locale}"`);
    expect(html, path).toContain(`dir="${direction}"`);
  }
}

test.describe("locale across authentication", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test("English survives landing, login, and the authenticated dashboard", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await signInFromLanding(page, context, "en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText("Your ministry space")).toBeVisible();
    await expect(page.locator('.tb2 a[href="/dashboard"]')).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("en");
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    ).toBe("en");

    await expectLocaleAcrossAppRoutes(context, "en");

    const response = await context.request.get(`${BASE_URL}/dashboard`);
    const html = await response.text();
    expect(html).toContain('lang="en"');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("Your ministry space");

    expect(errors).toEqual([]);
  });

  test("Arabic survives landing, login, and stays RTL", async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await signInFromLanding(page, context, "ar");

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("مساحتك الرعوية")).toBeVisible();
    await expect(page.locator('.tb2 a[href="/dashboard"]')).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("ar");
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    ).toBe("ar");

    await expectLocaleAcrossAppRoutes(context, "ar");

    const response = await context.request.get(`${BASE_URL}/dashboard`);
    const html = await response.text();
    expect(html).toContain('lang="ar"');
    expect(html).toContain('dir="rtl"');

    expect(errors).toEqual([]);
  });

  test("language toggle persists across reloads and keeps the session", async ({ page, context }) => {
    await signInFromLanding(page, context, "en");

    // The header toggle is localized: its aria-label is the *other* language.
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('.tb2 a[href="/dashboard"]')).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText("مساحتك الرعوية")).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Your ministry space")).toBeVisible();
    await expect(page.locator('.tb2 a[href="/dashboard"]')).toBeVisible();
  });
});

test.describe("auth-aware routing", () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test("authenticated visitors skip the landing, login, and register pages", async ({ page, context }) => {
    await seedSession(context);

    for (const path of ["/", "/login", "/register"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    }

    // The legacy app entry is a server component redirect rather than a page.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("protected deep links redirect to login and preserve the destination", async ({ page, context }) => {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await page.goto("/classes?view=grid");

    await expect(page).toHaveURL(/\/login\?next=/);
    const loginUrl = new URL(page.url());
    expect(loginUrl.searchParams.get("next")).toBe("/classes?view=grid");

    await seedSession(context);
    await page.locator("#identifier").fill("mina@example.test");
    await page.locator("#password").fill("password123");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/classes\?view=grid$/);
    await expect(page.getByRole("heading", { name: "Classes", exact: true })).toBeVisible();
  });

  test("logout clears the httpOnly session and returns to the public landing", async ({ page, context }) => {
    await signInFromLanding(page, context, "en");

    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("button", { name: "Log out" }).click();

    await page.waitForURL((url) => url.pathname === "/" && !url.search);
    await expect(page.locator(".ps-headerActions .ps-loginButton")).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE)).toBeUndefined();
    expect(cookies.find((cookie) => cookie.name === "refresh_token")).toBeUndefined();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("ss_token")))
      .toBeNull();
  });

  test("an expired session is logged out instead of looping on the dashboard", async ({ page, context }) => {
    await installApiMocks(page, { expired: true });
    await seedSession(context);
    await seedLocalAuth(page);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);

    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");
    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === SESSION_COOKIE)).toBeUndefined();
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("ss_token")))
      .toBeNull();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("a single refresh rotates the access token and retries the request", async ({ page, context }) => {
    let analyticsCalls = 0;
    await page.route("**/api/analytics/overview*", async (route) => {
      analyticsCalls += 1;
      if (analyticsCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Token expired" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ANALYTICS),
      });
    });

    await seedSession(context);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await seedLocalAuth(page);

    await page.goto("/dashboard");
    await expect(page.getByText("Your ministry space")).toBeVisible();

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("ss_token")))
      .toBe(REFRESHED_TOKEN);
    expect(analyticsCalls).toBeGreaterThanOrEqual(2);
    await expect(page).toHaveURL(/\/dashboard$/);

    // Sanity check: the harness really started with the original token.
    expect(TOKEN).not.toBe(REFRESHED_TOKEN);
  });
});

test.describe("motion in view", () => {
  test("entrance motion runs on desktop and mobile without horizontal overflow", async ({ browser }) => {
    const viewports = [
      { name: "desktop", width: 1366, height: 900, locale: "en" as const },
      { name: "mobile-english", width: 390, height: 844, locale: "en" as const },
      { name: "mobile-arabic", width: 390, height: 844, locale: "ar" as const },
    ];

    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.name.startsWith("mobile"),
        hasTouch: viewport.name.startsWith("mobile"),
      });
      const page = await context.newPage();
      await installApiMocks(page);
      await seedSession(context);
      await context.addCookies([{ name: LOCALE_COOKIE, value: viewport.locale, url: BASE_URL }]);
      await seedLocalAuth(page);
      await sampleMotion(page);

      await page.goto(`${BASE_URL}/dashboard`);
      await expect(page.locator("html")).toHaveAttribute("lang", viewport.locale);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        viewport.locale === "ar" ? "rtl" : "ltr",
      );
      await expect(
        page.getByText(viewport.locale === "ar" ? "مساحتك الرعوية" : "Your ministry space"),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const sample = await page.evaluate(
            () =>
              (window as unknown as { __motionSample: { min: number; samples: number } })
                .__motionSample,
          );
          return sample.samples;
        })
        .toBeGreaterThan(0);

      const sample = await page.evaluate(
        () =>
          (window as unknown as { __motionSample: { min: number; samples: number } })
            .__motionSample,
      );
      expect(sample.min, `${viewport.name}: entrance should start hidden`).toBeLessThan(0.9);

      await expect
        .poll(
          () =>
            page
              .locator("main section")
              .first()
              .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
          { message: `${viewport.name}: content should end fully visible` },
        )
        .toBeGreaterThan(0.95);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${viewport.name}: no horizontal overflow`).toBeLessThanOrEqual(1);

      await context.close();
    }
  });

  test("reduced motion shows content immediately with no hidden frame", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await installApiMocks(page);
    await seedSession(context);
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: BASE_URL }]);
    await seedLocalAuth(page);
    await sampleMotion(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.getByText("Your ministry space")).toBeVisible();

    expect(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
    ).toBe(true);

    const sample = await page.evaluate(
      () =>
        (window as unknown as { __motionSample: { min: number; samples: number } })
          .__motionSample,
    );
    expect(sample.samples).toBeGreaterThan(0);
    expect(sample.min).toBeGreaterThan(0.99);

    const motionStyles = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-motion]")).map((element) => {
        const computed = getComputedStyle(element);
        return {
          opacity: Number.parseFloat(computed.opacity),
          transform: computed.transform,
        };
      }),
    );
    expect(motionStyles.length).toBeGreaterThan(0);
    for (const style of motionStyles) {
      expect(style.opacity).toBe(1);
      expect(style.transform === "none" || style.transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
    }

    await context.close();
  });
});
