import { test, expect } from '@playwright/test'

let _sessionToken: string | null = null
let _userId: string | null = null

async function mockAuth(page: import('@playwright/test').Page, role = 'super') {
  const res = await page.request.post(`/api/test/setup-auth?role=${role}`)
  const data: { sessionToken: string; userId: string } = await res.json()
  _sessionToken = data.sessionToken
  _userId = data.userId

  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: data.sessionToken,
      url: 'http://localhost:3000',
    },
  ])
}

async function cleanupMockAuth() {
  if (!_sessionToken || !_userId) return
  await fetch('http://localhost:3000/api/test/teardown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: _sessionToken, userId: _userId }),
  })
  _sessionToken = null
  _userId = null
}

test.describe('Sales', () => {
  test.describe.configure({ timeout: 60000 })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/sales')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test.describe('authenticated as super', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'super')
      await page.goto('/dashboard/sales', { timeout: 60000 })
    })

    test('shows the sales page', async ({ page }) => {
      await expect(page.getByText('No invoices yet')).toBeVisible()
    })

    test('displays the sidebar with a Sales link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Sales' })).toBeVisible()
    })

    test('shows New Invoice button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /New Invoice/i })).toBeVisible()
    })

    test('opens invoice creation dialog', async ({ page }) => {
      await page.getByRole('button', { name: /New Invoice/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible()
    })
  })

  test.describe('authenticated as admin', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'admin')
      await page.goto('/dashboard/sales', { timeout: 60000 })
    })

    test('shows the sales page but no delete option', async ({ page }) => {
      await expect(page.getByText('No invoices yet')).toBeVisible()
    })
  })
})
