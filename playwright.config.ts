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
  use: {
    baseURL: BASE_URL,
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
