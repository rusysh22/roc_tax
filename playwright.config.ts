import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  // auth.spec.ts and core-flow.spec.ts run under their own configs.
  testIgnore: ["auth.spec.ts", "core-flow.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
