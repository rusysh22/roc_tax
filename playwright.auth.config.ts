import { defineConfig, devices } from "@playwright/test";
const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL || !new URL(databaseURL).pathname.endsWith("_test"))
  throw new Error("TEST_DATABASE_URL must point to an isolated _test database");
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "auth.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "off" },
  projects: [
    { name: "account-desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: databaseURL,
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      BETTER_AUTH_SECRET: "synthetic-e2e-only-secret-12345678901234567890",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1026",
      SMTP_FROM: "accounts@example.test",
      SMTP_USER: "",
      SMTP_PASSWORD: "",
    },
  },
});
