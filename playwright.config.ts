import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (spec §10). Two servers: an in-memory Postgres and a dev server with fake
// sign-in (E2E_FAKE_AUTH, see src/lib/e2e-guard.ts). Nothing touches Supabase or the real database.
const PORT = 3100;
const E2E_DATABASE_URL = "postgres://postgres@127.0.0.1:5433/postgres";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // one shared in-memory database
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "node e2e/test-db.mjs", port: 5433, reuseExistingServer: false, timeout: 30_000 },
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      // Process env wins over .env.local, so the real DATABASE_URL there is never used.
      env: { E2E_FAKE_AUTH: "1", DATABASE_URL: E2E_DATABASE_URL, NEXT_DIST_DIR: ".next-e2e", DEMO_HOST: "" },
    },
  ],
});
