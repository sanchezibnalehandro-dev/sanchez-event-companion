import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const organizerDevBearerToken = "playwright-local-organizer";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "protected-preview.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${organizerDevBearerToken}`,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    env: {
      EVENT_COMPANION_LOCAL_DEMO: "false",
      EVENT_COMPANION_DATABASE_DRIVER: "sqlite",
      ORGANIZER_DEV_BEARER_TOKEN: organizerDevBearerToken,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
