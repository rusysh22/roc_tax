import { defineConfig, devices } from "@playwright/test";
// Core business-flow E2E against the LOCAL dev stack with the seeded demo
// workspace (`npm run db:seed:dev`). It creates uniquely numbered synthetic
// transactions in the *_dev database on every run.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "core-flow.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 300000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "flow-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
