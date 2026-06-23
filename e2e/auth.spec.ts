import { test, expect, type Page } from '@playwright/test'

async function blockOAuthRedirects(page: Page) {
  await page.route('**/accounts.google.com/**', route => route.fulfill({ status: 200, body: '<html></html>' }))
  await page.route('**/facebook.com/**', route => route.fulfill({ status: 200, body: '<html></html>' }))
  await page.route('**/www.facebook.com/**', route => route.fulfill({ status: 200, body: '<html></html>' }))
}

test.describe('Auth', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('displays sign-in buttons for Google and Facebook', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign in with Facebook/i })).toBeVisible()
  })

  test('shows a heading and description on the login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
    await expect(page.getByText(/Choose your authentication provider/i)).toBeVisible()
  })

  test('shows error message when OAuth fails', async ({ page }) => {
    await page.goto('/login?error=OAuthSignIn')
    const alert = page.getByRole('alert').filter({ hasText: /error/i })
    await expect(alert).toBeVisible()
  })

  test('redirects unauthenticated users from dashboard to login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test('shows connecting state while OAuth redirect is in progress', async ({ page }) => {
    const googleButton = page.getByRole('button', { name: /Sign in with Google/i })
    await page.route('**/accounts.google.com/**', route => route.fulfill({ status: 200, body: '<html></html>' }))
    await Promise.all([
      expect(page.getByRole('button', { name: /Connecting\.\.\./i })).toBeVisible(),
      googleButton.click(),
    ])
  })

  test('login page is keyboard-navigable', async ({ page }) => {
    const googleButton = page.getByRole('button', { name: /Sign in with Google/i })
    const facebookButton = page.getByRole('button', { name: /Sign in with Facebook/i })

    await googleButton.focus()
    await expect(googleButton).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(facebookButton).toBeFocused()
  })
})
