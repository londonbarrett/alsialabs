# Playwright + Test Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Playwright e2e harness running against a long-lived Docker Postgres test database, with seven seeded role users and a session-cookie auth fixture.

**Architecture:** A `docker-compose.yml` service `test-db` owns a persisted Postgres volume. Playwright's `webServer` boots `pnpm dev` with env vars pre-set to the test DB (the app's `dotenv` call never overrides pre-set vars). A test seed script invokes the untouched existing seed as a child process, then upserts six additional users. Auth fixtures insert Auth.js database-strategy session rows and set the `authjs.session-token` cookie — no OAuth, no passwords.

**Tech Stack:** `@playwright/test` 1.61 (already installed), docker compose, PostgreSQL 17, drizzle-kit migrate, tsx, vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-23-playwright-test-db-design.md` — the plan argues from the spec; read both.

## Global Constraints

- Package manager: **pnpm**. No new dependencies may be installed without asking the partner (`@playwright/test` and `tsx` already exist; browsers are already cached for 1.61).
- Never hand-edit anything under `drizzle/` (SQL, snapshots, `_journal.json`). No schema changes are expected, so no `pnpm db:generate` should be needed.
- Production SSL behavior must stay byte-for-byte unchanged: when `DATABASE_SSL` is unset, the client must use `'require'` exactly as today (`lib/drizzle/client.ts`).
- Local setup only: **no** changes to `.github/workflows/` or other CI config.
- Committed files contain only fake values: test DB `alsia` / `alsia_test` at `localhost:55432`, URL `postgresql://alsia:alsia_test@localhost:55432/alsia_test`, emails at `@test.local`, placeholder `AUTH_SECRET`. Never commit a real secret; `.env.local` stays gitignored.
- `lib/drizzle/seed.ts` and `pnpm db:seed` must stay untouched.
- Exclusive dev server: `pnpm test:e2e` requires `pnpm dev` to be stopped first; `reuseExistingServer: false` enforces this.
- No changes to `messages/en.json` / `messages/es.json` (assertions use URLs and roles, never UI copy).
- `pnpm verify` must be green at the end: `tsc --noEmit` + `eslint --max-warnings=0` + vitest coverage ≥ 60% lines/functions/statements, 50% branches.
- Vitest and coverage must ignore Playwright artifacts: `e2e/**`, `playwright.config.ts`, `lib/drizzle/seed-e2e.ts` are excluded from test collection and/or coverage (the e2e seed script is infra, not unit-testable product code).

## Review Focus

Five failure modes the spec implies that are most likely to bite:

1. **App must boot against a non-SSL local Postgres** — expected: `/login` renders while `webServer` points at the plain-text test DB. Pinned by Task 4's login-page smoke test (the page runs `auth()`, which queries the DB) and Task 1's unit test of the SSL resolver.
2. **Fixtures must read the TEST database, not the dev one** — the `.env.local` `dotenv` load is the trap: expected: `signInAs("super")` finds `super@test.local` only in the test DB. Pinned by Task 5's authenticated smoke test; the fixture throws an explicit "run pnpm test:db:setup" error when the lookup fails.
3. **Vitest must not collect Playwright specs** — both frameworks use `*.spec.ts`; expected: `pnpm test:run` collects zero files from `e2e/` and the coverage floor still holds. Pinned by Task 4's verification steps.
4. **Re-running setup on the long-lived DB must not duplicate rows or violate unique constraints** — expected: running `pnpm test:db:seed` twice leaves exactly 7 users. Pinned by Task 3's double-seed verification.
5. **The session cookie name/attrs must match Auth.js on localhost http** — expected: with cookie `authjs.session-token`, `/app` does not redirect to `/login`; a wrong name (e.g. `__Secure-` prefix) silently fails auth. Pinned by Task 5's authenticated URL assertion.

## File Structure

| File                              | Responsibility                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Create: `lib/drizzle/ssl.ts`      | Pure resolver mapping `DATABASE_SSL` → postgres.js `ssl` option (default `'require'`)                                    |
| Create: `lib/drizzle/ssl.test.ts` | Unit tests for the resolver                                                                                              |
| Modify: `lib/drizzle/client.ts`   | Use the resolver instead of hardcoded `'require'`                                                                        |
| Create: `docker-compose.yml`      | `test-db` service: pinned Postgres, named volume, healthcheck, port 55432                                                |
| Create: `lib/drizzle/seed-e2e.ts` | Idempotent test seed: runs existing seed as child process (super user), adds 6 users + roles                             |
| Create: `playwright.config.ts`    | Chromium project, `webServer` (`pnpm dev`, `reuseExistingServer: false`), applies test env to `process.env` for fixtures |
| Create: `e2e/fixtures.ts`         | `TEST_USERS`, `TestRole`, extended `test` with `signInAs(role)`, re-exported `expect`                                    |
| Create: `e2e/smoke.spec.ts`       | Harness smoke: unauthenticated redirect, login page renders, authenticated session stays in `/app`                       |
| Modify: `package.json`            | Scripts: `test:db:up/down/migrate/seed/setup`, `test:e2e`                                                                |
| Modify: `vitest.config.ts`        | Exclude `e2e/**` from tests; exclude e2e artifacts from coverage                                                         |
| Modify: `.gitignore`              | `test-results/`, `playwright-report/`, `blob-report/`                                                                    |

Dependency order: Task 1 (SSL) must precede Tasks 3–5 (anything connecting to the non-SSL container); Task 2 precedes 3; Task 3 precedes 4 (`test:e2e` runs `test:db:setup`); Task 4 precedes 5.

---

### Task 1: Env-driven SSL option for the DB client

**Files:**

- Create: `lib/drizzle/ssl.ts`
- Test: `lib/drizzle/ssl.test.ts`
- Modify: `lib/drizzle/client.ts` (the `ssl: 'require'` line)

**Interfaces:**

- Consumes: env var `DATABASE_SSL` (unset/`require`/`prefer`/`disable`).
- Produces: `export function resolveSslOption(value: string | undefined): "require" | "prefer" | false` — used by `client.ts` as `ssl: resolveSslOption(process.env.DATABASE_SSL)`; postgres.js types accept `'require' | 'allow' | 'prefer' | 'verify-full' | boolean | object`, so `false` type-checks.

- [ ] **Step 1: Write the failing test**

```ts
// lib/drizzle/ssl.test.ts
import { describe, expect, it } from "vitest"
import { resolveSslOption } from "./ssl"

describe("resolveSslOption", () => {
  it("keeps the legacy default when unset or empty", () => {
    expect(resolveSslOption(undefined)).toBe("require")
    expect(resolveSslOption("")).toBe("require")
  })
  it("disables ssl only for explicit disable", () => {
    expect(resolveSslOption("disable")).toBe(false)
  })
  it("passes prefer through", () => {
    expect(resolveSslOption("prefer")).toBe("prefer")
  })
  it("falls back to require for unknown values", () => {
    expect(resolveSslOption("bogus")).toBe("require")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/drizzle/ssl.test.ts`
Expected: FAIL — module `./ssl` not found.

- [ ] **Step 3: Implement `resolveSslOption` in `lib/drizzle/ssl.ts` and wire it into the client**

Exact signature above. Mapping: `"disable"` → `false`; `"prefer"` → `"prefer"`; anything else (including `undefined`, `""`, `"require"`, unknown) → `"require"`. In `lib/drizzle/client.ts`, add the import and replace `ssl: 'require',` with `ssl: resolveSslOption(process.env.DATABASE_SSL),`. Nothing else in the client changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/drizzle/ssl.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/drizzle/ssl.ts lib/drizzle/ssl.test.ts lib/drizzle/client.ts
git commit -m "chore: make db ssl option env-driven"
```

---

### Task 2: Docker test database

**Files:**

- Create: `docker-compose.yml`
- Modify: `package.json` (scripts)

**Interfaces:**

- Produces: compose service `test-db` (image `postgres:17-alpine`, user/pass/db `alsia`/`alsia_test`/`alsia_test`, host port `55432` → `5432`, named volume `alsia_test_pgdata`, `pg_isready` healthcheck); scripts `test:db:up` (`docker compose up -d --wait`) and `test:db:down` (`docker compose down`). The connection URL `postgresql://alsia:alsia_test@localhost:55432/alsia_test` is consumed by Tasks 3–5.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  test-db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: alsia
      POSTGRES_PASSWORD: alsia_test
      POSTGRES_DB: alsia_test
    ports:
      - "55432:5432"
    volumes:
      - alsia_test_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U alsia -d alsia_test"]
      interval: 2s
      timeout: 3s
      retries: 30

volumes:
  alsia_test_pgdata:
```

- [ ] **Step 2: Add scripts to `package.json`**

```json
"test:db:up": "docker compose up -d --wait",
"test:db:down": "docker compose down",
```

- [ ] **Step 3: Verify the container comes up healthy**

Run: `pnpm test:db:up && docker compose exec test-db psql -U alsia -d alsia_test -tAc 'select 1'`
Expected: prints `1`. If `docker compose` is unavailable, stop and report to the partner.

- [ ] **Step 4: Verify the volume persists across restarts**

Run: `docker compose restart test-db && docker compose ps`
Expected: service state `running` (healthy after a few seconds), volume `alsia_test_pgdata` present.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml package.json
git commit -m "chore: add dockerized test database"
```

---

### Task 3: Migrations, seven-user test seed, setup script

**Files:**

- Create: `lib/drizzle/seed-e2e.ts`
- Modify: `package.json` (scripts), `vitest.config.ts` (coverage exclude)

**Interfaces:**

- Consumes: Task 2 URL + scripts; existing `lib/drizzle/seed.ts` (invoked, not modified); schema exports `usersTable`, `rolesTable`, `userRolesTable` from `./schema`; `db` from `./client`.
- Produces: script `test:db:seed` (idempotent; seeds exactly **7** users: `super@test.local` via the child seed with `ALSIA_STORE_EMAIL` override, plus `admin@test.local` → `admin`, `retailer@test.local` → `retailer`, `user1@test.local`…`user4@test.local` → `user`); scripts `test:db:migrate` and `test:db:setup`. Long-lived DB: re-running never duplicates rows.

- [ ] **Step 1: Add scripts to `package.json`**

```json
"test:db:migrate": "DB_DIRECT_URL=postgresql://alsia:alsia_test@localhost:55432/alsia_test pnpm db:migrate",
"test:db:seed": "DATABASE_URL=postgresql://alsia:alsia_test@localhost:55432/alsia_test DATABASE_SSL=disable tsx lib/drizzle/seed-e2e.ts",
"test:db:setup": "pnpm test:db:up && pnpm test:db:migrate && pnpm test:db:seed",
```

(`drizzle.config.ts` reads `DB_DIRECT_URL` from `dotenv` `.env.local`, which does not override a pre-set env var — hence the prefix. The seed's client-side `dotenv` behaves the same for `DATABASE_URL`.)

- [ ] **Step 2: Exclude the e2e seed from coverage**

In `vitest.config.ts`, add `coverage.exclude: ["lib/drizzle/seed-e2e.ts"]` (preserve vitest's defaults by spreading `configDefaults.exclude` if needed — e2e seed is infra, not product code).

- [ ] **Step 3: Write `lib/drizzle/seed-e2e.ts`**

Behavior (implementer writes the body; structure pinned):

1. `TEST_URL = "postgresql://alsia:alsia_test@localhost:55432/alsia_test"`.
2. Run the existing seed as a child process and require success:
   `spawnSync("pnpm", ["exec", "tsx", "lib/drizzle/seed.ts"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: TEST_URL, DATABASE_SSL: "disable", ALSIA_STORE_EMAIL: "super@test.local" } })` — if `status !== 0`, `process.exit(status ?? 1)`. (The child seed creates roles, permissions, taxonomies, the super user, and the company store; its own `dotenv` load cannot override the explicit env vars.)
3. Upsert the six remaining users, each with `crypto.randomUUID()` id, `onConflictDoNothing({ target: usersTable.email })`.
4. Look up each user's id by email and the role id by name from `rolesTable` (roles now exist from step 2), then `onConflictDoNothing()` into `userRolesTable` (its `user_id` column is unique, so re-runs no-op).
5. `console.log` a summary, `process.exit(0)`.

User/role pairs: `admin@test.local`→`admin`, `retailer@test.local`→`retailer`, `user1@test.local`…`user4@test.local`→`user`.

- [ ] **Step 4: Run setup and verify migration + seed**

Run: `pnpm test:db:setup`
Expected: compose up, migrations apply, seed prints summary; exit code 0.

- [ ] **Step 5: Verify exactly 7 users with correct roles**

Run:

```bash
docker compose exec test-db psql -U alsia -d alsia_test -tAc 'select count(*) from "user"'
docker compose exec test-db psql -U alsia -d alsia_test -tAc 'select u.email || \': \' || r.name from "user" u join user_role ur on ur.user_id = u.id join role r on r.id = ur.role_id order by u.email'
```

Expected: first query prints `7`; second prints 7 lines matching the pairs above (plus `super@test.local: super`).

- [ ] **Step 6: Verify idempotency (Review Focus #4)**

Run: `pnpm test:db:seed` then the same `select count(*)` query.
Expected: seed exits 0; count still exactly `7`.

- [ ] **Step 7: Commit**

```bash
git add lib/drizzle/seed-e2e.ts package.json vitest.config.ts
git commit -m "chore: add idempotent e2e test seed"
```

---

### Task 4: Playwright harness + unauthenticated smoke tests

**Files:**

- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json` (`test:e2e` script), `vitest.config.ts` (test + coverage excludes), `.gitignore`

**Interfaces:**

- Consumes: Task 3's `test:db:setup` (runs first via the `test:e2e` chain); base URL `http://localhost:3000`.
- Produces: `playwright.config.ts` default export with `testDir: "./e2e"`, `use.baseURL`, Chromium project, and a `webServer` (`command: "pnpm dev"`, `url: "http://localhost:3000"`, `reuseExistingServer: false`, `timeout: 120_000`, `env: { ...process.env }`) — after a module-level `Object.assign(process.env, testEnv)` where `testEnv` is:

```ts
const TEST_DB_URL =
  "postgresql://alsia:alsia_test@localhost:55432/alsia_test"
const testEnv = {
  DATABASE_URL: TEST_DB_URL,
  DB_DIRECT_URL: TEST_DB_URL,
  DATABASE_SSL: "disable",
  AUTH_SECRET: "e2e-only-not-a-real-secret",
} as const
```

(The `Object.assign` makes the test env visible to worker processes, which is what Task 5's fixture relies on; dotenv in `lib/drizzle/client.ts` then cannot override it. `webServer.env` spreads the full `process.env` so `next dev` gets the same values plus whatever else is present.) Script `"test:e2e": "pnpm test:db:setup && playwright test"`.

- [ ] **Step 1: Write `playwright.config.ts`**

As specified in the Interfaces block: imports `defineConfig, devices` from `@playwright/test`; `testDir: "./e2e"`; `fullyParallel: true`; `reporter: "list"`; `use: { baseURL: "http://localhost:3000" }`; one project `chromium` using `devices["Desktop Chrome"]`; the `webServer` with `reuseExistingServer: false`; `Object.assign(process.env, testEnv)` at module top before `defineConfig`.

- [ ] **Step 2: Write the unauthenticated smoke tests**

```ts
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test"

test("redirects unauthenticated visitors of /app to /login", async ({
  page,
}) => {
  await page.goto("/app")
  await expect(page).toHaveURL(/\/login/)
})

test("login page renders its two sign-in buttons", async ({ page }) => {
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("button")).toHaveCount(2)
})
```

(Two buttons: Google + Facebook — no UI copy, so no i18n coupling.)

- [ ] **Step 3: Add the `test:e2e` script, vitest excludes, and gitignore entries**

- `package.json`: `"test:e2e": "pnpm test:db:setup && playwright test"`.
- `vitest.config.ts`: add `"e2e/**"` to `test.exclude` and `"e2e/**"` + `"playwright.config.ts"` to `coverage.exclude` (merge with existing entries; keep the 60/50/60/60 thresholds untouched).
- `.gitignore`: add `test-results/`, `playwright-report/`, `blob-report/`.

- [ ] **Step 4: Run the e2e suite (Review Focus #1)**

Run: `pnpm test:e2e`
Expected: setup runs, dev server boots against the test DB, **2 passed**. This proves the app serves `/login` over a plain non-SSL connection that executes `auth()` (a real DB query).

- [ ] **Step 5: Verify vitest ignores e2e files (Review Focus #3)**

Run: `pnpm test:run`
Expected: PASS, zero tests collected from `e2e/` (no import/collect errors mentioning `@playwright/test`).

- [ ] **Step 6: Verify typecheck + lint**

Run: `pnpm typecheck && pnpm eslint playwright.config.ts e2e`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts package.json vitest.config.ts .gitignore
git commit -m "chore: add playwright harness with smoke tests"
```

---

### Task 5: Session-cookie auth fixture + authenticated smoke test

**Files:**

- Create: `e2e/fixtures.ts`
- Modify: `e2e/smoke.spec.ts` (switch imports to `./fixtures`, add one test)

**Interfaces:**

- Consumes: Task 4 config (worker env, baseURL); seeded users from Task 3; schema exports `sessionsTable` (`sessionToken` PK, `userId`, `expires`) and `usersTable`; `db` from `@/lib/drizzle/client`.
- Produces: `e2e/fixtures.ts` exporting:
  - `TEST_USERS` — `{ super: "super@test.local", admin: "admin@test.local", retailer: "retailer@test.local", user1..user4: "userN@test.local" } as const`
  - `type TestRole = keyof typeof TEST_USERS`
  - `test` — Playwright `base.extend<{ signInAs: (role: TestRole) => Promise<void> }>`
  - `expect` (re-export)

`signInAs(role)` behavior: resolve `TEST_USERS[role]` → select user id by email (throw `Seeded user <email> not found — run "pnpm test:db:setup"` if missing) → insert `sessionsTable` row with `sessionToken = randomBytes(32).toString("hex")`, `userId`, `expires = new Date(Date.now() + 24h)` → `context.addCookies([{ name: "authjs.session-token", value: sessionToken, url: "http://localhost:3000" }])`.

- [ ] **Step 1: Write the failing test**

In `e2e/smoke.spec.ts`, change the import to `import { test, expect } from "./fixtures"` and append:

```ts
test("keeps a signed-in super user inside the app", async ({
  page,
  signInAs,
}) => {
  await signInAs("super")
  await page.goto("/app")
  await expect(page).toHaveURL(/\/app\//)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec playwright test smoke`
Expected: FAIL — `./fixtures` does not exist (module resolution error).

- [ ] **Step 3: Implement `e2e/fixtures.ts`**

As specified in the Interfaces block. Imports: `randomBytes` from `crypto`, `eq` from `drizzle-orm`, `test as base, expect` from `@playwright/test`, `db` from `@/lib/drizzle/client`, `sessionsTable, usersTable` from `@/lib/drizzle/schema` (Playwright resolves the tsconfig `@/*` paths; if it does not, use relative imports instead — do not add a path-mapping config for this alone).

- [ ] **Step 4: Run the full e2e suite (Review Focus #2 and #5)**

Run: `pnpm test:e2e`
Expected: **3 passed**. The authenticated test passes only if the fixture read the _test_ DB (only it has `super@test.local`) and the cookie name matches Auth.js (a wrong name would redirect to `/login` and fail the URL assertion).

- [ ] **Step 5: Run the full verification gate**

Run: `pnpm verify`
Expected: green — typecheck, lint `--max-warnings=0`, vitest coverage meeting 60/50/60/60 floors.

- [ ] **Step 6: Commit**

```bash
git add e2e/fixtures.ts e2e/smoke.spec.ts
git commit -m "chore: add session-cookie auth fixture for e2e"
```
