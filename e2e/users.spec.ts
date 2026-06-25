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

test.describe('Users', () => {
  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/users')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test.describe('authenticated as super', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'super')
      await page.goto('/dashboard/users')
      await page.waitForLoadState('networkidle')
    })

    test('shows the users page with table', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.getByText('Name')).toBeVisible()
      await expect(page.getByText('Email')).toBeVisible()
      await expect(page.getByText('Role')).toBeVisible()
    })

    test('shows Add User button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible()
    })

    test('opens create dialog on Add User click', async ({ page }) => {
      await page.getByRole('button', { name: /Add User/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: 'Create User' })).toBeVisible()
    })

    test('shows email and role fields in create dialog', async ({ page }) => {
      await page.getByRole('button', { name: /Add User/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.locator('#create-email')).toBeVisible()
      await expect(dialog.getByRole('combobox')).toBeVisible()
    })

    test('shows Users link in sidebar', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
    })
  })

  test.describe('authenticated as admin', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'admin')
      await page.goto('/dashboard/users')
      await page.waitForLoadState('networkidle')
    })

    test('shows forbidden page for non-super users', async ({ page }) => {
      await expect(page.getByText('403')).toBeVisible()
      await expect(page.getByText("You don't have access to this page.")).toBeVisible()
    })

    test('does not show Users link in sidebar for non-super users', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible()
    })
  })

  test.describe('authenticated as client', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'client')
      await page.goto('/dashboard/users')
      await page.waitForLoadState('networkidle')
    })

    test('shows forbidden page for client users', async ({ page }) => {
      await expect(page.getByText('403')).toBeVisible()
      await expect(page.getByText("You don't have access to this page.")).toBeVisible()
    })
  })
})

test.describe('Profile', () => {
  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test.describe('authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'super')
      await page.goto('/dashboard/profile')
      await page.waitForLoadState('networkidle')
    })

    test('shows profile page with user details', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
      await expect(page.getByText('Name')).toBeVisible()
      await expect(page.getByText('Email')).toBeVisible()
      await expect(page.getByText('Role')).toBeVisible()
      await expect(page.getByText('Test User')).toBeVisible()
      await expect(page.getByText('super')).toBeVisible()
    })

    test('shows Profile link in sidebar', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible()
    })
  })
})
