import { test, expect } from '@playwright/test'

test.describe('Dashboard sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('displays the sidebar with three menu areas', async ({ page }) => {
    await expect(page.getByText('User')).toBeVisible()
    await expect(page.getByText('Navigation')).toBeVisible()
    await expect(page.getByText('Auxiliary')).toBeVisible()
  })

  test('renders all menu items from the config', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Calendar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Support' })).toBeVisible()
  })

  test('shows the app name in the sidebar header', async ({ page }) => {
    await expect(page.getByText('Alsia')).toBeVisible()
  })

  test('highlights a menu item when clicked', async ({ page }) => {
    await page.getByText('Profile').click()

    const profileButton = page.locator(
      '[data-sidebar="menu-button"]'
    ).filter({ hasText: 'Profile' })
    await expect(profileButton).toHaveAttribute('data-active', 'true')
  })

  test('only one menu item is highlighted at a time', async ({ page }) => {
    const profile = page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Profile' })
    const settings = page.locator('[data-sidebar="menu-button"]').filter({ hasText: 'Settings' })

    await profile.click()
    await expect(profile).toHaveAttribute('data-active', 'true')
    await expect(settings).not.toHaveAttribute('data-active', 'true')

    await settings.click()
    await expect(settings).toHaveAttribute('data-active', 'true')
    await expect(profile).not.toHaveAttribute('data-active', 'true')
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
    await expect(page.getByText('Navigation')).toHaveCSS('opacity', '0')
    await expect(page.getByText('Auxiliary')).toHaveCSS('opacity', '0')
  })

  test('opens mobile sidebar via trigger button on small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/dashboard')

    const toggle = page.getByRole('button', { name: 'Toggle Sidebar' })
    await expect(toggle).toBeVisible()

    await toggle.click()
    await expect(page.getByText('Profile')).toBeVisible()
  })
})
