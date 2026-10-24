import { defineConfig, devices } from "@playwright/test"

const TEST_DB_URL =
  "postgresql://alsia:alsia_test@localhost:55432/alsia_test"
const testEnv = {
  DATABASE_URL: TEST_DB_URL,
  DB_DIRECT_URL: TEST_DB_URL,
  DATABASE_SSL: "disable",
  AUTH_SECRET: "e2e-only-not-a-real-secret",
} as const

Object.assign(process.env, testEnv)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env } as Record<string, string>,
  },
})
