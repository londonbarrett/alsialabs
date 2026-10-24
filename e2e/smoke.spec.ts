import { test, expect } from "@playwright/test"

test("redirects unauthenticated visitors of /app to /login", async ({
  page,
}) => {
  await page.goto("/app")
  await expect(page).toHaveURL(/\/login/)
})

test("login page renders its two sign-in buttons", async ({ page }) => {
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("button")).toHaveCount(2)
})
