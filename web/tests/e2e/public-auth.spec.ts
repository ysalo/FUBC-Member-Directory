import { expect, test } from "@playwright/test";

test("group routes require authentication", async ({ page }) => {
  await page.goto("/groups");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/groups/60000000-0000-4000-8000-000000000001");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin/groups");
  await expect(page).toHaveURL(/\/login$/);
});

test("shows SSO-only login without Apple by default", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("does not store a separate password"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", {
      name: "New accounts need administrator approval",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("An administrator must approve it", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.locator('input[type="password"], input[type="email"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("login has no horizontal overflow on supported viewports", async ({
  page,
}) => {
  await page.goto("/login");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  const google = page.getByRole("button", { name: "Continue with Google" });
  expect((await google.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("language choice persists and localizes the login screen", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "English", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Українська", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ласкаво просимо" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Створити обліковий запис", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Нові облікові записи потребують схвалення адміністратора",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Українська", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Продовжити з Google" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ласкаво просимо" }),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "app_locale",
    )?.value,
  ).toBe("uk");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
});

for (const action of ["Sign in", "Create account"]) {
  test(`${action} uses the existing Google OAuth callback`, async ({
    page,
  }) => {
    let authorizationUrl = "";
    await page.route("**/auth/v1/authorize?**", async (route) => {
      authorizationUrl = route.request().url();
      await route.fulfill({
        contentType: "text/html",
        body: "<p>OAuth provider fixture</p>",
      });
    });
    await page.goto("/login?next=%2Fgroups");
    await page.getByRole("button", { name: action, exact: true }).click();
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect.poll(() => authorizationUrl).not.toBe("");
    const params = new URL(authorizationUrl).searchParams;
    expect(params.get("provider")).toBe("google");
    const callback = new URL(params.get("redirect_to")!);
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/groups");
  });
}

test("OAuth exceptions announce an error and allow retry after an accessible busy state", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = () =>
      new Promise<ArrayBuffer>((_resolve, reject) => {
        window.addEventListener(
          "reject-oauth",
          () => {
            crypto.subtle.digest = originalDigest;
            reject(new Error("Fixture: PKCE unavailable"));
          },
          { once: true },
        );
      });
  });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const busy = page.getByRole("button", { name: "Opening Google…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(busy.locator("svg")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Opening Google…");
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("reject-oauth")));
  await expect(
    page.getByRole("region", { name: "Welcome" }).getByRole("alert"),
  ).toHaveText("That provider is unavailable right now. Please try again.");
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(page.getByRole("status")).toBeEmpty();
  await page.route("**/auth/v1/authorize?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>OAuth retry succeeded</p>",
    }),
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page.getByText("OAuth retry succeeded")).toBeVisible();
});

test("invalid OAuth callbacks return a generic login error", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=https://example.com");
  await expect(page).toHaveURL(/\/login\?error=oauth_failed$/);
  await expect(
    page.getByText("Sign-in could not be completed. Please try again."),
  ).toBeVisible();
});

test("web manifest describes a standalone private directory", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("Private Member Directory");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
});
