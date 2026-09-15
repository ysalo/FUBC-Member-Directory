import { expect, test } from "@playwright/test";

test("shows SSO-only login without Apple by default", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Apple" })).toHaveCount(0);
  await expect(page.getByText("does not store a separate password")).toBeVisible();
});

test("login has no horizontal overflow on supported viewports", async ({ page }) => {
  await page.goto("/login");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const google = page.getByRole("button", { name: "Continue with Google" });
  expect((await google.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});

test("invalid OAuth callbacks return a generic login error", async ({ page }) => {
  await page.goto("/auth/callback?next=https://example.com");
  await expect(page).toHaveURL(/\/login\?error=oauth_failed$/);
  await expect(page.getByText("Sign-in could not be completed. Please try again.")).toBeVisible();
});

test("web manifest describes a standalone private directory", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("Private Member Directory");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(3);
});
