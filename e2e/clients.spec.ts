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

test.describe("Clients", () => {
  test.describe.configure({ timeout: 60000 })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard/clients")
    await page.waitForURL("**/login")
    await expect(
      page.getByRole("heading", { name: /Sign in/i })
    ).toBeVisible()
  })

  test.describe("authenticated as super", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "super")
      await page.goto("/dashboard/clients", { timeout: 60000 })
    })

    test("shows the clients page with table", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Clients" })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: /Import data/i })
      ).toBeVisible()
      await expect(page.getByRole("table")).toBeVisible()
    })

    test("displays the sidebar with a Clients link", async ({
      page,
    }) => {
      await expect(
        page.getByRole("link", { name: "Clients" })
      ).toBeVisible()
    })

    test("each client row has an actions dropdown", async ({
      page,
    }) => {
      const firstRow = page.getByRole("row").nth(1)
      await expect(firstRow.getByRole("button")).toBeVisible()
    })

    test("shows New Client button next to Import Data", async ({
      page,
    }) => {
      await expect(
        page.getByRole("button", { name: /New Client/i })
      ).toBeVisible()
      await expect(
        page.getByRole("button", { name: /Import data/i })
      ).toBeVisible()
    })

    test("opens create dialog on New Client click", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /New Client/i }).click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByRole("heading", { name: "New Client" })
      ).toBeVisible()
    })

    test("shows validation errors on empty submit", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /New Client/i }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.getByRole("button", { name: /Create Client/i }).click()
      await expect(page.getByText("Name is required")).toBeVisible()
      await expect(page.getByText("Phone is required")).toBeVisible()
    })

    test("closes dialog on Cancel", async ({ page }) => {
      await page.getByRole("button", { name: /New Client/i }).click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.getByRole("button", { name: /Cancel/i }).click()
      await expect(page.getByRole("dialog")).not.toBeVisible()
    })

    test("opens edit dialog from actions menu", async ({ page }) => {
      const firstActionsBtn = page
        .getByRole("row")
        .nth(1)
        .getByRole("button")
      await firstActionsBtn.click()
      await page.getByText("Edit").click()
      await expect(page.getByRole("dialog")).toBeVisible()
      await expect(page.getByText("Edit Client")).toBeVisible()
    })

    test("submit button shows spinner while saving", async ({
      page,
    }) => {
      await page.getByRole("button", { name: /New Client/i }).click()
      await page
        .getByRole("dialog")
        .locator("#name")
        .fill("Test Client")
      await page
        .getByRole("dialog")
        .locator("#phone")
        .fill("+1234567890")
      await page.getByRole("button", { name: /Create Client/i }).click()
      await expect(
        page.getByRole("button", { name: /Create Client/i })
      ).toBeDisabled()
    })

    test("super can delete a client from actions menu", async ({
      page,
    }) => {
      const firstActionsBtn = page
        .getByRole("row")
        .nth(1)
        .getByRole("button")
      await firstActionsBtn.click()
      await expect(page.getByText("Delete")).toBeVisible()
    })
  })

  test.describe("authenticated as admin", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "admin")
      await page.goto("/dashboard/clients", { timeout: 60000 })
    })

    test("shows the clients page with table", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: "Clients" })
      ).toBeVisible()
      await expect(page.getByRole("table")).toBeVisible()
    })

    test("admin cannot see delete button in actions menu", async ({
      page,
    }) => {
      const firstActionsBtn = page
        .getByRole("row")
        .nth(1)
        .getByRole("button")
      await firstActionsBtn.click()
      await expect(page.getByText("Edit")).toBeVisible()
      await expect(page.getByText("Delete")).not.toBeVisible()
    })
  })

  test.describe("authenticated as user", () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, "user")
      await page.goto("/dashboard/clients", { timeout: 60000 })
    })

    test("shows forbidden page for user without clients:view", async ({
      page,
    }) => {
      await expect(page.getByText("403")).toBeVisible()
      await expect(
        page.getByText("You don't have access to this page.")
      ).toBeVisible()
    })

    test("dashboard sidebar hides Clients link for user without clients:view", async ({
      page,
    }) => {
      await page.goto("/dashboard", { timeout: 60000 })
      await expect(
        page.getByRole("link", { name: "Clients" })
      ).not.toBeVisible()
    })
  })
})
