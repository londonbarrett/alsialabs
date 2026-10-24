# Playwright + Test Database Setup — Design

Date: 2026-10-23
Status: awaiting partner approval

## Intent

Give the agent (and humans) a working end-to-end test environment so Playwright
tests can be written and run locally against realistic, authenticated,
role-aware scenarios. Today `@playwright/test` is installed but there is no
config, no `e2e/` directory, no scripts, and no test database — nothing can run.

The setup centers on a long-lived Docker Postgres instance used only by tests,
seeded with several users across roles, and a Playwright auth helper that
injects database-strategy session cookies so tests never touch real OAuth.

## Goals

- `pnpm test:e2e` runs Playwright specs locally against a Docker Postgres
  container, booting the app automatically.
- A seeded set of users covering all four roles: `super`, `admin`, `retailer`,
  and **four users with the `user` role** (features like team/permission flows
  need multiple regular users — seven users total).
- A one-line auth helper: a test asks for a role/user and gets an
  authenticated Playwright context via injected session cookie.
- The test DB is long-lived (persisted Docker volume); tests clean up records
  they created only when leaving them would break later tests.
- Nothing sensitive is committed: fake emails only, all secrets stay in
  gitignored env files.

## Non-goals / anti-goals

- **No CI integration** — local setup only (partner confirmed).
- **No real `/login` page test** — dropped for now; if added later it would
  only assert the page and OAuth redirect initiation, never complete OAuth.
- No test of Google/Facebook themselves; no live accounts.
- No fresh/dropped database per run (explicitly rejected — long-lived instead).
- No password/credentials login — the app has none (providers are
  Google/Facebook only); don't invent one.
- No multi-browser matrix for now (Chromium only).

## Constraints & repo facts

- Package manager: pnpm. Next.js 16 App Router, TypeScript, Drizzle ORM.
- `@playwright/test` `^1.61.0` is already in `package.json` dependencies;
  nothing else Playwright-related exists (no config, no `e2e/`, no scripts,
  no gitignore entries for Playwright artifacts).
- **Auth** (`lib/auth.ts`): NextAuth v5, `session: { strategy: "database" }`,
  `DrizzleAdapter`, providers Google + Facebook only, `pages.signIn = "/login"`.
  The `session` callback fetches the user's role and attaches
  `session.user.role`.
- **Session table** (`lib/drizzle/schema.ts:99`): `session(sessionToken PK,
userId FK → user.id cascade, expires timestamp)`. Cookie value IS the
  session token — no signing needed, so `AUTH_SECRET` is irrelevant to the
  helper. Default Auth.js cookie name is `authjs.session-token`
  (`__Secure-` prefix only under https; local http → confirm exact name
  while building).
- **DB client** (`lib/drizzle/client.ts`): loads `.env.local` via `dotenv`
  (`config()` does **not** override env vars already set in the environment),
  and hardcodes `ssl: 'require'`.
- **Existing seed** (`lib/drizzle/seed.ts`, run with `pnpm db:seed` via tsx):
  idempotent-ish (`onConflictDoNothing`) seeding of roles, permissions,
  role-permissions, taxonomies, categories; optionally one super user from
  `ALSIA_STORE_EMAIL` plus a company store; ends with `process.exit(0)`.
- `.gitignore` already covers `.env`, `.env*.local`, and keeps
  `!.env.example`.
- Migrations: `pnpm db:migrate` (drizzle-kit, never hand-edit migrations).

## Decisions (as agreed)

1. **Long-lived test DB** — a Docker Postgres container with a named volume,
   separate from any dev database. No drop/recreate between runs; tests clean
   up after themselves only when necessary.
2. **Seven seeded users** — one each of `super`, `admin`, `retailer`, and four
   `user`-role users, with fake emails (e.g. `super@test.local`,
   `admin@test.local`, `retailer@test.local`, `user1@test.local` …
   `user4@test.local`). Committed seed data contains no secrets.
3. **Session-cookie auth fixture** — a Playwright helper inserts a `session`
   row (random runtime token, sensible `expires`) for the requested user and
   sets the session cookie on the context. One helper serves every user.
   Sensitive data never enters the repo: session tokens are generated at test
   runtime; OAuth secrets are not used by tests at all.
4. **No login-page test** for now.
5. **Exclusive dev server** — `pnpm test:e2e` requires `pnpm dev` to be
   stopped first (two servers would share the `.next` cache, and a running
   dev server points at the dev DB, not the test DB). No coexistence
   machinery.

## Decisions (my calls as builder-of-the-design — flag if wrong)

- **docker-compose.yml** at repo root (service name like `test-db`, pinned
  Postgres major version image, named volume, port mapped to a non-default
  host port to avoid colliding with any dev Postgres).
- **SSL change**: make the client's `ssl` setting env-driven (e.g.
  `DATABASE_SSL=require|prefer|disable`), **defaulting to today's
  `require`** so production behavior is byte-for-byte unchanged; the test
  webServer sets it off for plain local Postgres.
- **Env injection**: Playwright `webServer.env` provides `DATABASE_URL`
  (pointed at the container) and the SSL flag; because dotenv never
  overrides pre-set vars, `.env.local` stays untouched and dev workflow is
  unaffected. Test-specific secrets (fake OAuth IDs, `AUTH_SECRET`) come from
  the same mechanism or a gitignored `.env.test` — a committed
  `.env.test.example` documents required keys if any are needed.
- **Separate test seed script** (e.g. `lib/drizzle/seed-e2e.ts`, run via tsx):
  reuses/invokes the role-permission logic and additionally upserts the seven
  fake users and their roles, idempotently (safe to re-run on the long-lived
  DB). Existing `lib/drizzle/seed.ts` and `pnpm db:seed` stay untouched.
- **Playwright config**: `playwright.config.ts` at repo root; Chromium-only
  project; `webServer` runs the dev server against the test DB with a
  readiness wait; test files live in `e2e/`; output dirs
  (`test-results/`, `playwright-report/`) gitignored.
- **Scripts** to add in `package.json`: `test:e2e` (run tests), plus helpers
  for DB lifecycle (e.g. `test:db:up` / `test:db:down` or a combined setup
  script that brings up the container, migrates, and seeds).
- **Auth fixture shape**: a Playwright fixture/helper exported from `e2e/`
  (e.g. a `signInAs(role | userId)` helper or a per-role fixture) that does
  the DB insert + `context.addCookies`. Tests import it; they never hand-roll
  session logic.
- **Migrations** run against the test DB before first use (same
  `pnpm db:migrate` with the test `DATABASE_URL`).
- **Cleanup convention**: tests remove rows they created (or use unique
  run-prefixed identifiers) only when leftovers would corrupt assertions
  later; the shared seed is never deleted by tests.
- **First spec**: one small smoke spec proving the harness end-to-end
  (app boots, an authenticated fixture lands on an authenticated page).
  Future feature tests come later as separate requests.

## What's left to the builder

Implementation details below the decisions: exact compose file contents,
Playwright config wiring (`webServer` command/env/readiness URL), cookie
name/attributes verification, fixture ergonomics, seed script structure,
npm script naming, gitignore entries, and writing/verifying the smoke test.
Verification: `pnpm verify` must stay green; the e2e run itself must pass
against a fresh container (bring up → migrate → seed → run).
