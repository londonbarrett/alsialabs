import { test, expect } from "./fixtures"

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

test("keeps a signed-in super user inside the app", async ({
  page,
  signInAs,
}) => {
  await signInAs("super")
  await page.goto("/app")
  await expect(page).toHaveURL(/\/app\//)
})
