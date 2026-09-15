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
  const surface = page.getByRole("region", { name: "Welcome" });
  await expect(surface).toHaveCSS("background-color", "rgb(25, 31, 40)");
  await expect(
    page.getByRole("button", { name: "English", exact: true }),
  ).toHaveCSS("background-color", "rgb(25, 31, 40)");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("light preference overrides a dark device and invalid preferences use system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("directory-theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "light",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("region", { name: "Welcome" })).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.evaluate(() => localStorage.setItem("directory-theme", "invalid"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-preference",
    "system",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("localized login fits at larger text sizes in dark mode", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page
    .context()
    .addCookies([
      { name: "app_locale", value: "uk", url: "http://127.0.0.1:3000" },
    ]);
  await page.goto("/login");
  await page.evaluate(() => {
    document.documentElement.dataset.textSize = "large";
  });
  await page
    .getByRole("button", { name: "Створити обліковий запис", exact: true })
    .click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    ),
  ).toBe(false);
  for (const language of ["English", "Українська"]) {
    const button = page.getByRole("button", { name: language, exact: true });
    await expect(button).toBeVisible();
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
});
