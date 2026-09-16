import { expect, test } from "@playwright/test";

for (const id of ["60000000-0000-4000-8000-000000000001", "not-a-uuid"]) {
  test(`member route ${id} requires authentication`, async ({ page }) => {
    await page.goto(`/members/${id}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator(".login-logo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Member profile" })).toHaveCount(0);
  });
}

test("Google login preserves the requested OAuth callback destination", async ({ page }) => {
  let authorizationUrl = "";
  await page.route("**/auth/v1/authorize?**", async (route) => {
    authorizationUrl = route.request().url();
    await route.fulfill({ contentType: "text/html", body: "<p>OAuth fixture</p>" });
  });
  await page.goto("/login?next=%2Fgroups");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => authorizationUrl).not.toBe("");
  const params = new URL(authorizationUrl).searchParams;
  expect(params.get("provider")).toBe("google");
  const callback = new URL(params.get("redirect_to")!);
  expect(callback.pathname).toBe("/auth/callback");
  expect(callback.searchParams.get("next")).toBe("/groups");
});

test("OAuth exceptions announce an error and allow retry", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = () => new Promise<ArrayBuffer>((_resolve, reject) => {
      window.addEventListener("reject-oauth", () => {
        crypto.subtle.digest = originalDigest;
        reject(new Error("Fixture: PKCE unavailable"));
      }, { once: true });
    });
  });
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const busy = page.getByRole("button", { name: "Opening Google…" });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toHaveText("Opening Google…");
  await page.evaluate(() => window.dispatchEvent(new Event("reject-oauth")));
  await expect(page.getByRole("region", { name: "Login" }).getByRole("alert")).toHaveText("That provider is unavailable right now. Please try again.");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  await expect(page.getByRole("status")).toBeEmpty();
});

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
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(page.locator(".login-logo")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("does not store a separate password"),
  ).toHaveCount(0);
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
  await page.getByRole("button", { name: "УКР" }).click();
  await expect(
    page.getByRole("button", { name: "Продовжити з Google" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Продовжити з Google" }),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "app_locale",
    )?.value,
  ).toBe("uk");
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
