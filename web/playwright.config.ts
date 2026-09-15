import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "iphone-13", use: { ...devices["iPhone 13"] } },
    {
      name: "iphone-17-pro-max",
      use: { ...devices["iPhone 17 Pro Max"] },
    },
    {
      name: "future-large-iphone",
      use: {
        ...devices["iPhone 17 Pro Max"],
        viewport: { width: 460, height: 1000 },
      },
    },
    { name: "iphone-se", use: { ...devices["iPhone SE"] } },
  ],
  webServer: {
    command:
      process.env.PLAYWRIGHT_USE_BUILD === "1"
        ? "node node_modules/next/dist/bin/next start"
        : process.platform === "win32"
          ? "node_modules\\.bin\\next.cmd dev"
          : "pnpm dev",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
