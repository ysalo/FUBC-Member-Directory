import { expect, test } from "@playwright/test";

test("system appearance follows the device and explicit preference persists", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.evaluate(() => localStorage.setItem("directory-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const surface = page.locator(".bg-white").first();
  await expect(surface).toHaveCSS("background-color", "rgb(25, 31, 40)");
});
