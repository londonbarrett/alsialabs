import { test, expect } from '@playwright/test'

let _sessionToken: string | null = null
let _userId: string | null = null

async function mockAuth(page: import('@playwright/test').Page) {
  const res = await page.request.post('/api/test/setup-auth')
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

test.describe('Clients', () => {
  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/clients')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test.describe('authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page)
      await page.goto('/dashboard/clients')
      await page.waitForLoadState('networkidle')
    })

    test('shows the clients page with table', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Import data/i })).toBeVisible()
      await expect(page.getByRole('table')).toBeVisible()
    })

    test('displays the sidebar with a Clients link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()
    })

    test('each client row has an actions dropdown', async ({ page }) => {
      const firstRow = page.getByRole('row').nth(1)
      await expect(firstRow.getByRole('button')).toBeVisible()
    })
  })
})
