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

function trackPageRequests(page: Page, path: string) {
  const seen: string[] = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.pathname === path) seen.push(`${req.method()} ${url.search}`)
  })
  return { seen, reset: () => seen.splice(0, seen.length) }
}

/**
 * Focus refresh is owned by the route's store provider, exactly once. Before
 * that move `RemindersCard` and `InactiveClientsCard` each registered their own
 * listener, so `/app/actividad` issued two `router.refresh()` per focus.
 */
test('the activity page refreshes once per focus', async ({ page }) => {
  test.setTimeout(60000)
  await mockAuth(page)
  await page.goto('/app/actividad', { timeout: 60000 })
  await page.waitForTimeout(2000)

  const requests = trackPageRequests(page, '/app/actividad')
  requests.reset()
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
  await page.waitForTimeout(3000)

  await cleanupMockAuth()
  expect(requests.seen.length).toBe(1)})
