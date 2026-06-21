---
description: Generate and run Playwright integration tests for the current issue
---

Generate and run Playwright integration tests for the current issue.

Parses Gherkin scenarios from the refined GitHub issue, generates `e2e/<page>.spec.ts` (idempotent), runs the suite, and auto-fixes failures up to 3 attempts.

### 1. Detect branch and ticket

Run `git branch --show-current` to get the current branch.

Extract the issue number from the branch name:
- `3-feat-dashboard` → `#3`
- `feat/3-dashboard` → `#3`
- `fix/3-login-bug` → `#3`
- `3` → `#3`
- `main`, `develop`, `master` → no ticket (show message)

Detect the ticket type from the branch name:
- `feat/*` → feature
- `fix/*` → bug fix
- Default → feature

If on a non-feature branch, respond with:

> No ticket selected. Checkout a feature branch first.

Fetch the issue via `GET /repos/{owner}/{repo}/issues/{number}`. Show its title and labels.

### 2. Read acceptance criteria

Parse the issue body for Gherkin scenarios under `## Acceptance Criteria`. Look for the pattern:

```
### Scenario: [title]
Given [context]
When [action]
Then [outcome]
```

**On `fix/*` branches only:** also read `## Description` to understand the bug being fixed. Generate a **regression test** that validates the fix — a test that would have failed before the fix was applied. Prefix it with a comment referencing the bug. Add it as the first test in the suite.

Also look for OpenSpec artifacts at `openspec/changes/<slug>/specs/`. If they exist, read any additional scenarios from the spec files.

If no Gherkin scenarios are found and the issue has no description, prompt the user: "No test scenarios found in this issue. Want to describe what should be tested?" Capture their answer and turn it into Gherkin scenarios.

### 3. Determine target page

Derive the target page name from the issue title, scope, or Description:

| Issue Keywords | Page Name |
|---|---|
| sidebar, navigation, dashboard | `dashboard` |
| login, auth, profile, sign in, register | `auth` |
| settings, preferences, config | `settings` |
| home, landing, root, hero | `home` |
| specs, refine, spec | `specs` |
| *(default)* | derive from title or scope |

Show the user: "Target page: `<page>`" and proceed.

### 4. Generate test file (idempotent)

If `e2e/<page>.spec.ts` exists, read it first. Parse existing `test('...')` titles from the file.

For each Gherkin `Scenario`, check if a test with the same title already exists:
- **Exists** → skip (print "Already exists: <title>")
- **Does not exist** → generate a new Playwright test from the Gherkin

**Test structure rules:**
- Import: `import { test, expect } from '@playwright/test'`
- Wrap in `test.describe('<PageName>', () => { ... })`
- Each `Scenario` → one `test('Scenario title', async ({ page }) => { ... })`
- Use `beforeEach` for `page.goto('/<route>')`
- **Locator priority:** `getByRole` → `getByLabel/getByPlaceholder` → `getByText` → `getByTestId` → `page.locator('css=...')`
- Use **web-first assertions** (auto-retry)
- No `page.waitForTimeout()` or manual delays

**Fix branches only:** Prepend the regression test (with comment `// Regression: <bug description>`) to the describe block.

**Append to file:** Insert new tests at the end of the existing describe block. Never duplicate an existing test title.

Show progress: "Generated <N> new tests for e2e/<page>.spec.ts"

### 5. Run tests

```bash
pnpm test:e2e
```

### 6. On failure: diagnose, fix, retry (up to 3 attempts)

If tests pass, skip to step 7.

If tests fail:

1. Read the error output — identify which test(s) failed and why
2. Read the failing test file to understand the test structure
3. **Diagnose the root cause:**
   - `locator not found` → locator is wrong or element isn't in the DOM → fix the locator (use stronger selectors, check for role/text)
   - `strict mode violation` → locator matches multiple elements → add `.filter()`, `.first()`, or use a more specific locator
   - `Test timeout` → element never appeared → check page URL, selector, or add missing setup
   - `toHaveAttribute` failure → attribute doesn't match → check the actual attribute value or use `not.toHaveAttribute` correctly
   - `opacity: 0` not hidden → use `toHaveCSS('opacity', '0')` instead of `not.toBeVisible()`
4. **Fix the test file** — edit the specific failing test(s) in `e2e/<page>.spec.ts`
5. **Re-run** `pnpm test:e2e`
6. If still failing after 3 retries, stop and show the full failure report with a suggestion to investigate manually

Show retry progress:
```
⚠ 2/3 tests passed — 1 failed
Retry 1/3: fixing "collapses sidebar on click"...
  → locator was ambiguous, switched to getByRole('button', { name: 'Toggle Sidebar' })
Re-running...
✓ All passing (retry 1)
```

### 7. Done

Show final summary:

```
✓ All tests pass for issue #N

  Tests scenarios: <N> generated, <N> already existed
  Updated: e2e/<page>.spec.ts
  Result: <N>/<N> passing

  Run /test again anytime to regenerate tests from the current issue.
```

On fix branches, add:
```
  Regression test added: <scenario title>
```

If max retries reached without full pass, show:

```
⚠ <N>/<N> tests passing after 3 retries

  Remaining failures:
  - <test title>: <error summary>

  Manual investigation recommended.
```

### GitHub API rules

- Repository: `londonbarrett/alsialabs`
- Use `GET /repos/{owner}/{repo}/issues/{number}` to fetch
- Use the `GITHUB_TOKEN` environment variable for auth
