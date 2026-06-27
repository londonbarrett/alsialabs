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

async function createProduct(page: import('@playwright/test').Page, name?: string) {
  const productName = name ?? 'Test Product ' + Date.now()
  await page.getByRole('button', { name: /Add Product/i }).click()
  await page.getByRole('dialog').locator('#name').fill(productName)
  await page.getByRole('dialog').locator('#provider_id').click()
  await page.getByRole('option').first().click()
  await page.getByRole('dialog').locator('#sku').fill('TST-' + Date.now())
  await page.getByRole('dialog').locator('#unit').fill('pcs')
  await page.getByRole('button', { name: /Create Product/i }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
}

test.describe('Products', () => {
  test.describe.configure({ timeout: 60000 })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForURL('**/login')
    await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible()
  })

  test.describe('authenticated as super', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'super')
      await page.goto('/dashboard/products', { timeout: 60000 })
    })

    test('displays the sidebar with a Products link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Products' })).toBeVisible()
    })

    test('opens create dialog on Add Product click', async ({ page }) => {
      await page.getByRole('button', { name: /Add Product/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('heading', { name: 'Add Product' })).toBeVisible()
    })

    test('shows validation errors on empty submit', async ({ page }) => {
      await page.getByRole('button', { name: /Add Product/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: /Create Product/i }).click()
      await expect(page.getByText('Name is required')).toBeVisible()
      await expect(page.getByText('Provider is required')).toBeVisible()
    })

    test('closes dialog on Cancel', async ({ page }) => {
      await page.getByRole('button', { name: /Add Product/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: /Cancel/i }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })

    test('creates a product and shows it in the table', async ({ page }) => {
      await createProduct(page)
      await expect(page.getByRole('table')).toBeVisible()
    })

    test('opens edit dialog from actions menu', async ({ page }) => {
      await createProduct(page)
      const firstActionsBtn = page.getByRole('row').nth(1).getByRole('button')
      await firstActionsBtn.click()
      await page.getByRole('menuitem', { name: /Edit/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Edit Product')).toBeVisible()
    })

    test('submit button shows spinner while saving', async ({ page }) => {
      await page.getByRole('button', { name: /Add Product/i }).click()
      await page.getByRole('dialog').locator('#name').fill('Spinner Test')
      await page.getByRole('dialog').locator('#provider_id').click()
      await page.getByRole('option').first().click()
      await page.getByRole('button', { name: /Create Product/i }).click()
      await expect(page.getByRole('button', { name: /Create Product/i })).toBeDisabled()
    })

    test('super can see delete button in actions menu', async ({ page }) => {
      await createProduct(page)
      const firstActionsBtn = page.getByRole('row').nth(1).getByRole('button')
      await firstActionsBtn.click()
      await expect(page.getByRole('menuitem', { name: /Delete/i })).toBeVisible()
    })

    test('deletes a product from actions menu', async ({ page }) => {
      await createProduct(page, 'To Be Deleted')
      const firstActionsBtn = page.getByRole('row').nth(1).getByRole('button')
      await firstActionsBtn.click()
      await page.getByRole('menuitem', { name: /Delete/i }).click()
      const deleteDialog = page.getByRole('dialog').last()
      await expect(deleteDialog).toBeVisible()
      await expect(deleteDialog.getByRole('heading', { name: 'Delete Product' })).toBeVisible()
      await deleteDialog.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('authenticated as admin', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'admin')
      await page.goto('/dashboard/products', { timeout: 60000 })
    })

    test('shows the products page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible()
    })

    test('admin cannot see delete button in actions menu', async ({ page }) => {
      await createProduct(page, 'Admin Product')
      const firstActionsBtn = page.getByRole('row').nth(1).getByRole('button')
      await firstActionsBtn.click()
      await expect(page.getByRole('menuitem', { name: /Edit/i })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Delete/i })).not.toBeVisible()
    })
  })

  test.describe('authenticated as client', () => {
    test.beforeEach(async ({ page }) => {
      await mockAuth(page, 'client')
      await page.goto('/dashboard/products', { timeout: 60000 })
    })

    test('shows forbidden page for client without products:view', async ({ page }) => {
      await expect(page.getByText('403')).toBeVisible()
      await expect(page.getByText("You don't have access to this page.")).toBeVisible()
    })

    test('dashboard sidebar hides Products link for client without products:view', async ({ page }) => {
      await page.goto('/dashboard', { timeout: 60000 })
      await expect(page.getByRole('link', { name: 'Products' })).not.toBeVisible()
    })
  })
})
