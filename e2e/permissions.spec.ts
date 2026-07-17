import { test, expect } from "@playwright/test"

let _sessionToken: string | null = null
let _userId: string | null = null

async function mockAuth(
  page: import("@playwright/test").Page,
  role = "super"
) {
  const res = await page.request.post(
    `/api/test/setup-auth?role=${role}`
  )
  const data: { sessionToken: string; userId: string } =
    await res.json()
  _sessionToken = data.sessionToken
  _userId = data.userId

  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: data.sessionToken,
      url: "http://localhost:3000",
    },
  ])
}

async function cleanupMockAuth() {
  if (!_sessionToken || !_userId) return
  await fetch("http://localhost:3000/api/test/teardown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionToken: _sessionToken,
      userId: _userId,
    }),
  })
  _sessionToken = null
  _userId = null
}

test.describe("Permissions", () => {
  test.describe.configure({ timeout: 60000 })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard/permissions")
    await page.waitForURL("**/login")
    await expect(
      page.getByRole("heading", { name: /Sign in/i })
    ).toBeVisible()
  })

  test.describe("authenticated as super", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "super")
      await page.goto("/dashboard/permissions", { timeout: 60000 })
    })

    test("shows the permissions page with matrix", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Permissions" })
      ).toBeVisible()
      await expect(page.getByRole("table")).toBeVisible()
      await expect(
        page.getByRole("cell", { name: "clients", exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("cell", { name: "permissions", exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole("cell", { name: "users", exact: true })
      ).toBeVisible()
    })

    test("can add a new module", async ({ page }) => {
      await page.getByRole("button", { name: "Add Module" }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.locator("#module-name").fill("testmod")
      await page.locator("#module-actions").fill("view, delete")
      await page.getByRole("button", { name: "Create" }).click()
      await expect(page.getByRole("dialog")).not.toBeVisible({
        timeout: 15000,
      })
      await expect(page.getByText("testmod")).toBeVisible()
    })

    test("can delete a module", async ({ page }) => {
      await page.getByRole("button", { name: "Add Module" }).click()
      await page.locator("#module-name").fill("todelete")
      await page.locator("#module-actions").fill("view")
      await page.getByRole("button", { name: "Create" }).click()
      await page.waitForTimeout(300)
      await expect(page.getByText("todelete")).toBeVisible()

      const deleteBtn = page
        .getByRole("row")
        .filter({ hasText: "todelete" })
        .getByRole("button")
        .last()
      await deleteBtn.click()
      await expect(page.getByText("todelete")).not.toBeVisible({
        timeout: 10000,
      })
    })

    test("shows toggle switches for each permission-role cell", async ({
      page,
    }) => {
      const switches = page.locator('button[role="switch"]')
      const count = await switches.count()
      expect(count).toBeGreaterThan(0)
    })

    test("shows Permissions link in sidebar", async ({ page }) => {
      await expect(
        page.getByRole("link", { name: "Permissions" })
      ).toBeVisible()
    })

    test("can toggle a permission switch", async ({ page }) => {
      const firstSwitch = page.locator('button[role="switch"]').first()
      await expect(firstSwitch).toBeVisible()
      await firstSwitch.click()
      await page.waitForTimeout(500)
    })
  })

  test.describe("authenticated as admin", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "admin")
      await page.goto("/dashboard/permissions")
      await page.waitForLoadState("networkidle")
    })

    test("shows forbidden page for non-super users", async ({
      page,
    }) => {
      await expect(page.getByText("403")).toBeVisible()
      await expect(
        page.getByText("You don't have access to this page.")
      ).toBeVisible()
    })

    test("does not show Permissions link in sidebar", async ({
      page,
    }) => {
      await expect(
        page.getByRole("link", { name: "Permissions" })
      ).not.toBeVisible()
    })
  })

  test.describe("authenticated as user", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "user")
      await page.goto("/dashboard/permissions")
      await page.waitForLoadState("networkidle")
    })

    test("shows forbidden page for user users", async ({ page }) => {
      await expect(page.getByText("403")).toBeVisible()
      await expect(
        page.getByText("You don't have access to this page.")
      ).toBeVisible()
    })
  })
})
