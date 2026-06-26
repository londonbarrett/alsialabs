import { test, expect, type Page } from '@playwright/test'

let _sessionToken: string | null = null
let _userId: string | null = null

async function mockAuth(page: Page) {
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

function getToggle(page: Page) {
  return page.getByRole('button', { name: /Switch to/ })
}

test.describe('Dashboard sidebar', () => {
  test.describe.configure({ timeout: 60000 })

  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
    await page.goto('/dashboard', { timeout: 60000 })
  })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('displays the sidebar with four menu areas for super users', async ({ page }) => {
    await expect(page.getByText('User')).toBeVisible()
    await expect(page.getByText('Admin')).toBeVisible()
    await expect(page.getByText('Navigation')).toBeVisible()
    await expect(page.getByText('Auxiliary')).toBeVisible()
  })

  test('renders all menu items from the config', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Permissions' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Clients' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sales' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Support' })).toBeVisible()
  })

  test('shows the app name in the sidebar header', async ({ page }) => {
    await expect(page.getByText('Alsia').first()).toBeVisible()
  })

  test('highlights a menu item when clicked', async ({ page }) => {
    const profileButton = page.locator(
      '[data-sidebar="menu-button"]'
    ).filter({ hasText: 'Profile' })

    await profileButton.click()
    await expect(profileButton).toHaveAttribute('data-active', 'true')
  })

  test('only one menu item is highlighted at a time', async ({ page }) => {
    const profileItem = page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Profile' })
    const clientsItem = page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Clients' })

    await profileItem.click()
    await expect(profileItem).toHaveAttribute('data-active', 'true')
    await expect(clientsItem).not.toHaveAttribute('data-active', 'true')

    await clientsItem.click()
    await expect(clientsItem).toHaveAttribute('data-active', 'true')
    await expect(profileItem).not.toHaveAttribute('data-active', 'true')
  })

  test('collapses and expands the sidebar via toggle button', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' })
    const shell = page.locator('[data-slot="sidebar"]').first()

    await expect(shell).toHaveAttribute('data-state', 'expanded')

    await toggle.first().click()
    await expect(shell).toHaveAttribute('data-state', 'collapsed')

    await toggle.first().click()
    await expect(shell).toHaveAttribute('data-state', 'expanded')
  })

  test('hides group labels when sidebar is collapsed', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' })
    await toggle.first().click()

    await expect(page.getByText('User')).toHaveCSS('opacity', '0')
    await expect(page.getByText('Admin')).toHaveCSS('opacity', '0')
    await expect(page.getByText('Navigation')).toHaveCSS('opacity', '0')
    await expect(page.getByText('Auxiliary')).toHaveCSS('opacity', '0')
  })

  test('opens mobile sidebar via trigger button on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' })
    await expect(toggle).toBeVisible()

    await toggle.click()

    const mobileSidebar = page.locator('[data-slot="sidebar"][data-mobile="true"]')
    await expect(mobileSidebar).toBeVisible()
    await expect(mobileSidebar.getByText('Profile')).toBeVisible()
  })

  test('shows the theme toggle button in the sidebar aux area', async ({ page }) => {
    const toggle = getToggle(page)
    await expect(toggle).toBeVisible()
  })

  test('changes theme class on click and persists after reload', async ({ page }) => {
    const toggle = getToggle(page)
    const html = page.locator('html')

    // System starts as 'system' (resolves to 'light' in headless Chrome)
    // Click 1: system → light
    await toggle.click()
    await expect(html).toHaveClass(/light/)

    // Click 2: light → dark
    await toggle.click()
    await expect(html).toHaveClass(/dark/)

    // Persists after reload
    await page.reload()
    await expect(html).toHaveClass(/dark/)
  })
})
