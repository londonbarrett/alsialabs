# Project Country and Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required per-project country, derive currency and number formatting from it, and surface both on the project form, details page, and project cards.

**Architecture:** One new `country` column on `projects` (non-null, default CO) plus a shared Americas country→currency/locale map in `lib/projects/location.ts`. Currency is never stored; every money surface spreads `projectMoneyProps(country)` into the existing `Money`/`MoneyInput` components. The value flows through the existing project actions, optimistic stores, and forms.

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle/postgres, zod 4, next-intl, shadcn Select, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-project-location-currency-design.md`
**Related:** `docs/superpowers/specs/2026-11-22-decimal-money-design.md` (already implemented; supplies `Money`/`MoneyInput` fraction behavior).

## Global Constraints

- `projects.country`: `text("country").notNull().default("CO").$type<ProjectCountry>()`. The column default backfills existing rows; no separate data script.
- No `currency` column, no currency selector, no conversion. Currency/locale are derived at read time.
- `ProjectRecordSchema.country` must be `z.enum(PROJECT_COUNTRIES)` (matching `DbProject`), not `z.string()`. No `as` casts or `any`.
- Country list: ISO 3166-1 alpha-2 codes covering the Americas, ordered north to south. Every code has a `COUNTRY_FORMAT` entry with a currency code and a formatting locale.
- `DEFAULT_COUNTRY = "CO"`; `defaultCountryForLocale`: `es → CO`, `en → US`, fallback CO. DB default is always CO.
- Option labels from `Intl.DisplayNames` (region/currency) using the UI locale; stored value is the code.
- `projectMoneyProps(country)` returns `{ currency, locale }`; all project money surfaces spread it into `Money`/`MoneyInput`.
- Reuse `common.location`, `common.budget`. Add `common.country`, `common.currency`, `projects.countryRequired` to **both** `messages/en.json` and `messages/es.json` with identical structure.
- No invoice changes. No changes to `formatCurrency` or invoice totals.
- Generate the migration with `pnpm db:generate`; never hand-edit `drizzle/`.
- Do not commit (project AGENTS.md requires explicit permission).

## Review Focus

- **Existing projects have no country value** — the `DEFAULT 'CO'` backfill must be in the generated SQL, and the edit form must prefill CO for those rows — Task 2 migration review + Task 4 form test.
- **Type agreement between `DbProject` and `ProjectRecordDTO`** — a widening to `z.string()` breaks `setEditingProject(result.data)` in `project-details.tsx` — Task 3 schema test and typecheck.
- **Optimistic create/edit must show the right country and currency immediately** — Task 5 store tests and Task 8 E2E.
- **Card spend/budget are relabeled, not converted** — formatting changes but amounts must not change — Task 7 card test + Task 8 E2E.
- **Locale default (es→CO, en→US) must not leak into the DB default** — Task 1 helper test + Task 8 E2E.

---

### Task 1: Country constants and helpers

**Files:**
- Create: `lib/projects/location.ts`
- Create: `lib/projects/location.test.ts`

**Interfaces:**
- Produces:
  - `PROJECT_COUNTRIES` (readonly tuple), `ProjectCountry`
  - `COUNTRY_FORMAT: Record<ProjectCountry, { currency: string; locale: string }>`
  - `DEFAULT_COUNTRY: ProjectCountry = "CO"`
  - `defaultCountryForLocale(locale: string): ProjectCountry`
  - `currencyForCountry(country: ProjectCountry): string`, `localeForCountry(country: ProjectCountry): string`
  - `projectMoneyProps(country: ProjectCountry): { currency: string; locale: string }`
  - `countryLabel(country: ProjectCountry, locale: string): string`, `currencyLabel(currency: string, locale: string): string`

- [ ] **Step 1: Write failing tests**

In `lib/projects/location.test.ts` assert: every `PROJECT_COUNTRIES` entry has a `COUNTRY_FORMAT` entry; the list includes `CA, US, MX, CO, BR, AR, CL` and is ordered North→Central→Caribbean→South; `defaultCountryForLocale("es") === "CO"`, `("en") === "US"`, `("fr") === "CO"`; `projectMoneyProps("CO")` deep-equals `{ currency: "COP", locale: "es-CO" }` and `projectMoneyProps("US")` equals `{ currency: "USD", locale: "en-US" }`; `countryLabel("CO", "es") === "Colombia"`; `currencyLabel("COP", "es")` is non-empty.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run lib/projects/location.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the constants and helpers**

Use the spec's starting country set and mappings. Every code must have an entry. `projectMoneyProps` returns the stored pair. Label helpers use `new Intl.DisplayNames(locale, { type: "region" })` / `{ type: "currency" }` with a fallback to the code. No translation keys for names.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run lib/projects/location.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 2: Database column and generated migration

**Files:**
- Modify: `lib/drizzle/schema.ts:377-402` (`projectsTable`)
- Create: generated `drizzle/0031_*.sql` + `drizzle/meta/*` via `pnpm db:generate`

**Interfaces:**
- Consumes: `ProjectCountry`, `DEFAULT_COUNTRY`, `PROJECT_COUNTRIES` from Task 1.
- Produces: `projectsTable.country` typed as `ProjectCountry`, non-null, default `"CO"`.

- [ ] **Step 1: Add the column**

In `lib/drizzle/schema.ts`, add to `projectsTable`:
`country: text("country").notNull().default(DEFAULT_COUNTRY).$type<ProjectCountry>()`.
Import the constants from `@/lib/projects/location`. Leave `location` untouched.

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new numbered SQL file and snapshot/journal entries are created.

- [ ] **Step 3: Review the generated SQL**

Read the generated SQL. It must contain an `ALTER TABLE "project" ADD COLUMN "country" text DEFAULT 'CO' NOT NULL` (or equivalent) so existing rows are backfilled. Do not hand-edit. If the SQL lacks the default, stop and report BLOCKED.

- [ ] **Step 4: Verify the task**

Run: `pnpm verify` (do not apply the migration to a shared database here; E2E setup applies it to the test DB).
Expected: PASS.

---

### Task 3: Project schemas, queries, and action tests

**Files:**
- Modify: `actions/projects/schemas.ts:61-101,154-175,198-206`
- Modify: `actions/projects/queries.ts:16-85,214-349,379-441`
- Modify: `actions/projects/projects.test.ts`

**Interfaces:**
- Consumes: `PROJECT_COUNTRIES`, `DEFAULT_COUNTRY` from Task 1; `projectsTable.country` from Task 2.
- Produces: `country` on `ProjectDTO`, `ProjectRecordDTO`, `ProjectDetailDTO`, `ProjectOptionDTO`, `ProjectSummaryDTO`.

- [ ] **Step 1: Write failing action tests**

In `actions/projects/projects.test.ts`, add assertions that `createProject` persists the supplied `country`, `updateProject` changes it, omitting `country` on create stores `"CO"`, and `getProjectForEdit`/`getProjectsWithDetails` output includes `country`. Use the existing mock/seed patterns in that file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run actions/projects/projects.test.ts`
Expected: FAIL — `country` missing from results.

- [ ] **Step 3: Add `country` to the zod schemas**

In `actions/projects/schemas.ts`: `ProjectSchema` gets `country: z.enum(PROJECT_COUNTRIES).default(DEFAULT_COUNTRY)`; `ProjectRecordSchema` gets `country: z.enum(PROJECT_COUNTRIES)`; `ProjectSummarySchema` gets the same. Add the inferred DTO type to the existing type block. Do not add a new action.

- [ ] **Step 4: Thread `country` through the queries**

In `actions/projects/queries.ts`, add `country: projectsTable.country` to the select lists in `getProjectOptions` (~27), `getProjectsForUser` (~65), and `getProjectById` (~362); add `country` to the mapped row in `getProjectSummaries` (~340); destructure and write `country` in `createProject` (~390-406) and `updateProject` (~420-437).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run actions/projects/projects.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the task**

Run: `pnpm verify`
Expected: PASS (this is where a `DbProject`/DTO type mismatch would surface).

---

### Task 4: Form field and translations

**Files:**
- Modify: `components/projects/project-form.tsx:19-95,230-246`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `defaultCountryForLocale`, `projectMoneyProps`, `countryLabel` from Task 1; `ProjectCountry` type.
- Produces: `ProjectFormValues.country: ProjectCountry`; Country select and budget `MoneyInput` wired to the derived currency.

- [ ] **Step 1: Add translations to both locale files**

Add `common.country` ("Country"/"País"), `common.currency` ("Currency"/"Moneda"), and `projects.countryRequired` ("Country is required"/"El país es obligatorio"). Keep both files structurally identical. Do not add name keys for countries or currencies.

- [ ] **Step 2: Add country state and validation**

In `components/projects/project-form.tsx`: add `country: ProjectCountry` to `ProjectFormValues`; add `useState<ProjectCountry>(project?.country ?? defaultCountryForLocale(locale))` using `useLocale()` from next-intl; add a validation branch setting `errors.country = t("projects.countryRequired")` when empty; include `country` in the submitted object.

- [ ] **Step 3: Render the Country select and wire the budget input**

Add a shadcn `Select` using the existing Category/Status pattern, options from `PROJECT_COUNTRIES` labelled with `countryLabel(code, locale)`, in list order. Pass `{...projectMoneyProps(country)}` to the Budget `Field` (`type="money"`) so its currency/locale follow the selected country. Keep the free-text Location field unchanged.

- [ ] **Step 4: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 5: Optimistic stores

**Files:**
- Modify: `stores/project-context/use-project-actions.ts:18-39`
- Modify: `stores/projects/use-projects-actions.ts:23-53,55-103`
- Modify: `stores/project-context/project-context-store.test.ts`
- Modify: `stores/projects/projects-store.test.ts`

**Interfaces:**
- Consumes: `country` on `ProjectUpdateDTO`, `ProjectRecordDTO`, `ProjectSummaryDTO` from Task 3.
- Produces: optimistic patch and optimistic create row carry `country`.

- [ ] **Step 1: Write failing store tests**

Assert that `toOptimisticPatch()` includes `country` and that `buildOptimisticProject()` / the commit mapping carry `country` from form values and from the server row.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run stores/project-context stores/projects`
Expected: FAIL.

- [ ] **Step 3: Add `country` to the optimistic paths**

Add `country: values.country` to `toOptimisticPatch()`; add `country` to `buildOptimisticProject` and to the commit mapping from `r.data`. No reducer changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run stores/project-context stores/projects`
Expected: PASS.

- [ ] **Step 5: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 6: Project details page

**Files:**
- Modify: `components/projects/project-details.tsx:1-40,97-195`

**Interfaces:**
- Consumes: `project.country` from `useProjectContextState()`; `projectMoneyProps`, `countryLabel`, `currencyLabel`, `currencyForCountry` from Task 1.
- Produces: read-only Country and Currency rows; budget formatted with the country's currency/locale.

- [ ] **Step 1: Add the two rows**

In the existing three-column field grid, add a Country entry (reuse `MapPin`, label `common.country`, value `countryLabel(project.country, locale)`) and a Currency entry (use `CircleDollarSign`, label `common.currency`, value from `currencyLabel(currencyForCountry(project.country), locale)`). Keep Location, dates, Budget, and Description unchanged.

- [ ] **Step 2: Format the budget with the country**

Change `<Money value={project.budget} />` to `<Money value={project.budget} {...projectMoneyProps(project.country)} />`. Do not pass a UI-locale override.

- [ ] **Step 3: Verify the task**

Run: `pnpm verify`
Expected: PASS. Do not change `components/projects/project-view.tsx`.

---

### Task 7: Project cards

**Files:**
- Modify: `components/projects/project-card.tsx:1-10,64-68,174-233`

**Interfaces:**
- Consumes: `project.country` (from `ProjectSummaryDTO`), `projectMoneyProps`, `countryLabel`.
- Produces: card Country row and country-formatted spend/budget display.

- [ ] **Step 1: Replace the hardcoded formatter**

Remove the module-level `Intl.NumberFormat("en-US", { currency: "USD" })` at lines 64-68 and import `Money`. Render `project.expenses` and `project.budget` via `<Money value={...} {...projectMoneyProps(project.country)} />` while keeping `tabular-nums`, the over-budget color treatment, and the progress math unchanged.

- [ ] **Step 2: Add the Country row**

In the meta grid under the Location entry, add a Country entry with `MapPin`, `common.country` label, and `countryLabel(project.country, locale)` value. Use `useLocale()` for the label locale. Keep the Location entry as-is.

- [ ] **Step 3: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 8: End-to-end coverage

**Files:**
- Create: `e2e/project-country.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: Playwright proof of country selection, derived currency, and card/details display.

- [ ] **Step 1: Write the E2E spec**

Using `test`/`expect` from `./fixtures` and `signInAs("<role>")` (least-privileged role that can create/edit projects, chosen from `e2e/fixtures.ts`), cover:
- create a project with country US; assert the details page and its card show United States / USD and USD-formatted budget
- edit the same project to Colombia; assert both surfaces update to Colombia / COP with es-CO formatting, including the card's spend figure
- assert a new project's Country select defaults from the locale (`es → CO`, `en → US`) using the app's locale switch or cookie
- assert the free-text Location field still works and is unchanged

- [ ] **Step 2: Run E2E**

Run: `pnpm test:e2e`
Expected: PASS, including existing specs.

- [ ] **Step 3: Final verification**

Run: `pnpm verify`
Expected: PASS. Do not commit; ask the user first.
