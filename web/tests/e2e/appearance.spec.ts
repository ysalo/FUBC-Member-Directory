import { expect, test } from "@playwright/test";

test("system appearance follows the device and explicit preference persists", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const login = page.locator(".login-page");
  await expect(login).toHaveCSS("color-scheme", "dark");
  expect(
    await login.evaluate((node) =>
      getComputedStyle(node).getPropertyValue("--app-surface").trim(),
    ),
  ).toBe("#122331");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(login).toHaveCSS("color-scheme", "dark");
  expect(
    await login.evaluate((node) =>
      getComputedStyle(node).getPropertyValue("--app-surface").trim(),
    ),
  ).toBe("#122331");
  await page.evaluate(() => localStorage.setItem("directory-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--app-surface")
        .trim(),
    ),
  ).toBe("#122331");
});
