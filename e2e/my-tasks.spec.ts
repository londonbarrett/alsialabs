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

const PAGE_PATH = '/app/mis-tareas'

/**
 * Requests the browser makes for this exact route, which is what both
 * `router.refresh()` and a server-side filter fetch look like.
 */
function trackPageRequests(page: Page) {
  const seen: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname === PAGE_PATH) seen.push(`${req.method()} ${url.search}`)
  })
  return {
    seen,
    reset: () => seen.splice(0, seen.length),
  }
}

/**
 * The two filter triggers. Labels are matched in both locales because the app
 * ships `messages/en.json` and `messages/es.json`.
 */
function statusFilter(page: Page) {
  return page
    .getByRole('combobox')
    .filter({ hasText: /All statuses|Todos los estados/ })
    .first()
}

function projectFilter(page: Page) {
  return page
    .getByRole('combobox')
    .filter({ hasText: /All projects|Todos los proyectos/ })
    .first()
}

test.describe('My Tasks page', () => {
  test.describe.configure({ timeout: 60000 })

  test.beforeEach(async ({ page }) => {
    await mockAuth(page)
  })

  test.afterEach(async () => {
    await cleanupMockAuth()
  })

  test('renders with the store provider mounted', async ({ page }) => {
    await page.goto(PAGE_PATH, { timeout: 60000 })

    // MyTasksView reads through useMyTasksState, so a missing provider throws
    // at the boundary instead of rendering.
    await expect(page.getByText('must be used within')).toHaveCount(0)
    await expect(statusFilter(page)).toBeVisible()
    await expect(projectFilter(page)).toBeVisible()
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  test('narrowing a filter does not hit the network', async ({ page }) => {
    await page.goto(PAGE_PATH, { timeout: 60000 })
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible()

    // The status trigger is the first combobox on the page (the app shell
    // renders none, and the filters sit above the table). It is located by
    // order rather than by label because its label changes once a status is
    // selected, while row status selects are also labelled with that status.
    const statusTrigger = page.getByRole('combobox').first()
    await expect(statusTrigger).toHaveText(/All statuses|Todos los estados/)

    const before = await rows.count()
    expect(before).toBeGreaterThan(1)

    // Let viewport prefetches settle, then start counting.
    await page.waitForTimeout(1000)
    const requests = trackPageRequests(page)
    requests.reset()

    // Pick a concrete status so the projection is measurably narrower.
    await statusTrigger.click()
    const option = page.getByRole('option').nth(1)
    const label = (await option.innerText()).trim()
    await option.click()
    await expect(rows.first()).toBeVisible()
    // The trigger appends a chevron glyph, so match the label as a substring.
    await expect(statusTrigger).toContainText(label)

    // Every surviving row carries the status just chosen: the list was
    // narrowed by the projection, not by a refetch.
    await expect(rows.filter({ hasNotText: label })).toHaveCount(0)
    expect(await rows.count()).toBeLessThanOrEqual(before)

    // Clearing the filter restores the original set without a request either.
    await statusTrigger.click()
    await page.getByRole('option').first().click()
    await expect(rows.first()).toBeVisible()
    await expect.poll(() => rows.count()).toBe(before)

    expect(requests.seen).toEqual([])
  })

  test('regaining focus refreshes the page', async ({ page }) => {
    await page.goto(PAGE_PATH, { timeout: 60000 })
    await expect(page.locator('table tbody tr').first()).toBeVisible()

    await page.waitForTimeout(1000)
    const requests = trackPageRequests(page)
    requests.reset()

    // The real event targets `document` and bubbles up to `window`, which is
    // where useRefreshOnFocus listens.
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    })
    await page.waitForTimeout(3000)

    // Exactly one: the provider owns the listener now, so no consumer can
    // register a second and double the request.
    expect(requests.seen.length).toBe(1)
  })
})
