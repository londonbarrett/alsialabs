import { defineConfig, devices } from "@playwright/test"

const TEST_DB_URL =
  "postgresql://alsia:alsia_test@localhost:55432/alsia_test"
const E2E_PORT = 3100
const BASE_URL = `http://localhost:${E2E_PORT}`
const testEnv = {
  DATABASE_URL: TEST_DB_URL,
  DB_DIRECT_URL: TEST_DB_URL,
  DATABASE_SSL: "disable",
  AUTH_SECRET: "e2e-only-not-a-real-secret",
  NEXT_PUBLIC_APP_URL: BASE_URL,
  ALSIA_DIST_DIR: ".next-e2e",
} as const

Object.assign(process.env, testEnv)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  // The suite drives a dev server: a cold route compile can push a test past
  // the 30s default without any product fault, so give tests more room and
  // one retry before calling it a failure.
  timeout: 45_000,
  retries: 1,
  use: {
    baseURL: BASE_URL,
    // Specs drive the UI by its labels, which are locale-dependent; pin the
    // browser to the app's default locale so they do not depend on the
    // runner's ambient Accept-Language.
    locale: "es-ES",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${E2E_PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env } as Record<string, string>,
  },
})
