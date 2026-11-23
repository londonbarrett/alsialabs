# Decimal Money Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every money field accept and display fractional amounts using its currency's own decimal precision, without changing the database schema.

**Architecture:** Move decimal parsing/formatting into pure helpers in `lib/util/money.ts`, then make `MoneyInput`, `Money`, the task-cost zod/SQL pipeline, and the project budget field consume them. A jsdom-based component test covers typing and caret behavior; E2E covers persistence through real forms.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest 4, `@testing-library/react` + `user-event`, Playwright, Drizzle/postgres, zod 4.

**Spec:** `docs/superpowers/specs/2026-11-22-decimal-money-design.md`

## Global Constraints

- No database migration: every money column is already `numeric(12, 2)`.
- Fraction digits: max = `currencyFractionDigits(currency, locale)` capped at 2; min = 0 for whole values, max when a fractional part is present. Whole USD shows `$150`, fractional USD shows `$150.50`, COP shows `$150`.
- `MoneyInput` emits canonical strings with `.` as the decimal separator; it keeps a trailing separator visible while typing (`150.` → `$150.`).
- Negative and non-numeric input stays rejected. Stored values are never rounded to the currency's digit count.
- Every money input uses `USD`/`en-US` defaults in this plan. Do not add project-country logic here.
- Do not change `formatCurrency` or invoice total calculations.
- `messages/en.json` and `messages/es.json` stay structurally identical; add no new translation keys in this plan.
- Do not commit. `AGENTS.md` requires explicit user permission before any commit or push.
- Verify with `pnpm verify` at the end of each task; fix failures before moving on.

## Review Focus

- **Typing `150.` must keep the separator visible so the next digit becomes cents** — component test in Task 4 plus E2E in Task 7; the formatter must not silently render `$150`.
- **Locale separators must not be confused**: `1.500,50` in es-CO means `1500.50`, not `150050` — helper unit test in Task 2.
- **Zero-fraction currencies must not produce cents**: a COP input ignores an attempted decimal — component test in Task 4.
- **Decimal task costs must not be rounded by the `::int` SQL casts** — query test in Task 5 with `12.50 + 7.25 = 19.75`.
- **Existing whole-amount displays must stay `$150`, not become `$150.00`** — component test in Task 3; existing `$150` E2E assertions in `task-costs.spec.ts` and `task-wizard-validation.spec.ts` must keep passing.

---

### Task 1: Component-test dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (generated)

**Interfaces:**
- Produces: jsdom + `@testing-library/react` + `@testing-library/dom` + `@testing-library/user-event` available to Vitest.

- [ ] **Step 1: Install the approved dev dependencies**

Run: `pnpm add -D jsdom @testing-library/react @testing-library/dom @testing-library/user-event`

- [ ] **Step 2: Confirm the existing suite is unaffected**

Run: `pnpm test:run`
Expected: all existing tests pass. Vitest keeps `environment: "node"` as the default; component tests will opt into jsdom with a per-file `// @vitest-environment jsdom` docblock, so no config change is needed.

---

### Task 2: Decimal-aware money helpers

**Files:**
- Modify: `lib/util/money.ts:1-32`
- Create: `lib/util/money.test.ts`

**Interfaces:**
- Produces:
  - `currencyFractionDigits(currency: string, locale?: string): number` — `Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits`, capped at 2.
  - `parseMoney(value: string, options?: { locale?: string; currency?: string }): string` — canonical `.`-separated decimal string, decimals capped at `min(currencyFractionDigits, 2)`; preserves a trailing `.`; returns `""` for empty/invalid/negative input.
  - `formatMoney(value: string | number, options?: { currency?: string; locale?: string }): string` — max `currencyFractionDigits`; min `0` when the value is whole, max when it has a fractional part; returns `""` on invalid input.
  - `parseMoney` and `formatMoney` keep working with a single argument (`USD`/`en-US`).

- [ ] **Step 1: Write failing tests for `currencyFractionDigits`**

In `lib/util/money.test.ts`, assert `currencyFractionDigits("USD") === 2`, `currencyFractionDigits("COP", "es-CO") === 0`, and `currencyFractionDigits("EUR", "de-DE") === 2`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/util/money.test.ts`
Expected: FAIL — function is not exported.

- [ ] **Step 3: Write failing tests for `parseMoney`**

In the same file, assert:
- `parseMoney("$1,500.50") === "1500.50"` (en-US default)
- `parseMoney("1.500,50", { locale: "es-ES", currency: "EUR" }) === "1500.50"`
- `parseMoney("150.") === "150."`
- `parseMoney("150,5", { currency: "COP", locale: "es-CO" }) === "150"` (zero-digit currency; es-CO's decimal separator is `,`)
- `parseMoney("") === ""`, `parseMoney("-5") === ""`, `parseMoney("abc") === ""`
- `parseMoney("12.345") === "12.34"` (`.` is the en-US decimal separator, so an over-long fraction is capped to two digits, never treated as grouping)

- [ ] **Step 4: Write failing tests for `formatMoney`**

Assert:
- `formatMoney("150") === "$150"`
- `formatMoney("150.5") === "$150.50"`
- `formatMoney("1500,5", { currency: "COP", locale: "es-CO" })` uses COP with at most 0 fraction digits and es-CO grouping
- `formatMoney("abc") === ""`

- [ ] **Step 5: Implement the three helpers in `lib/util/money.ts`**

Use locale `Intl.NumberFormat(...).formatToParts(1000.1)` to identify the locale's decimal and group separators; remove group separators and currency symbols, map the decimal separator to `.`, keep digits plus at most `min(currencyFractionDigits, 2)` decimals, and preserve a trailing `.`. In `formatMoney`, choose `minimumFractionDigits` from whether the parsed value has a fractional part. Cache formatter instances in a module-level map. Do not change `formatCurrency` or `formatQuantity`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run lib/util/money.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify the task**

Run: `pnpm verify`
Expected: typecheck, lint, and full coverage pass.

---

### Task 3: `Money` uses currency fraction digits

**Files:**
- Modify: `components/common/money.tsx:5-10,40-52`
- Create: `components/common/money.test.tsx`

**Interfaces:**
- Consumes: `formatMoney`, `currencyFractionDigits` from Task 2.
- Produces: unchanged `MoneyProps` and `Money` export.

- [ ] **Step 1: Write failing component tests**

In `components/common/money.test.tsx`, use `renderToStaticMarkup` from `react-dom/server` (no jsdom needed — `Money` has no hooks) and assert:
- `<Money value={150} />` renders `$150`, not `$150.00`
- `<Money value="150.5" />` renders `$150.50`
- `<Money value={150} currency="COP" locale="es-CO" />` renders a COP amount with no fraction digits
- `<Money value={null} />` renders `—`

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run components/common/money.test.tsx`
Expected: FAIL on the `"150.5"` case — the current component renders `$150.5` (min 0) instead of `$150.50`.

- [ ] **Step 3: Implement the change in `components/common/money.tsx`**

Remove the USD-specific `defaultFormatter`. When fraction props are absent, delegate to `formatMoney` from Task 2 so the minimum is `0` for whole values and the currency digit count when a fraction is present. Keep the existing `null`/`undefined`/`""`/`NaN` fallback and explicit-prop precedence.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run components/common/money.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 4: `MoneyInput` accepts decimals

**Files:**
- Modify: `components/common/money-input.tsx:17-48,50-70,83-127`
- Create: `components/common/money-input.test.tsx`

**Interfaces:**
- Consumes: `parseMoney`, `formatMoney`, `currencyFractionDigits` from Task 2.
- Produces: unchanged `MoneyInputProps` and `MoneyInput` export; `onChange` emits canonical decimal strings.

- [ ] **Step 1: Write failing component tests**

In `components/common/money-input.test.tsx`, start with `// @vitest-environment jsdom`, render with `@testing-library/react`, and use `@testing-library/user-event`. Assert:
- typing `150` emits `"150"` and displays `$150`
- typing `150.50` emits `"150.50"` and displays `$150.50`
- typing `150.` displays `$150.` (separator preserved) and the next digit yields `"150.5"`
- with `currency="COP" locale="es-CO"`, an attempted decimal is ignored and `onChange` never emits a `.`
- editing the middle of `$1,500` (not the end) keeps the caret after the edited digit

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run components/common/money-input.test.tsx`
Expected: FAIL — current `parseInteger` strips decimals.

- [ ] **Step 3: Implement decimal parsing and formatting in `components/common/money-input.tsx`**

Replace the local `parseInteger`/`formatInteger` with wrappers over `parseMoney`/`formatMoney`. Cap decimals at `currencyFractionDigits(currency, locale)`. When a parsed value ends with `.`, format its integer part and append the locale's decimal separator so the separator stays visible. Adapt `countDigitsBefore`/`findDigitPosition` to count digits **and** the decimal separator so the caret lands correctly. Change `inputMode` to `"decimal"`. Keep the `onChange` string contract and the existing `cn("tabular-nums", className)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run components/common/money-input.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify the task**

Run: `pnpm verify`
Expected: PASS, including full coverage thresholds.

---

### Task 5: Task cost pipeline accepts decimals

**Files:**
- Modify: `actions/tasks/schemas.ts:20-29`
- Modify: `components/projects/tasks/task-form.tsx:62-64`
- Modify: `actions/tasks/queries.ts:246-265,644-651`
- Modify: `actions/tasks/schemas.test.ts:207-234`
- Modify: `actions/tasks/tasks.test.ts:217-242`

**Interfaces:**
- Consumes: `MoneyInput` string contract from Task 4.
- Produces: `cost` values with up to two decimals persist and sum without rounding; `totalCost` stays a `number` on DTOs.

- [ ] **Step 1: Write failing schema tests**

In `actions/tasks/schemas.test.ts`, replace the "rejects negative and decimal costs" case with two cases: decimals and a trailing separator are accepted (`"12.50"`, `"12."`), while `"-5"`, `"abc"`, and `"1.234"` are still rejected. Keep the existing whole-unit and empty-field assertions.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run actions/tasks/schemas.test.ts`
Expected: FAIL on the decimal-acceptance assertions.

- [ ] **Step 3: Relax `CostInputSchema`**

In `actions/tasks/schemas.ts:25-29`, change the regex to `/^\d*(?:\.\d{0,2})?$/` and update the adjacent comment to describe decimal whole units. Keep `INVALID_COST` and the `.default("")`.

- [ ] **Step 4: Stop rewriting the DB cost string in the form**

In `components/projects/tasks/task-form.tsx:62-64`, initialize with `useState(task?.cost ?? "")`. Remove the now-unused `costToNumber` import from this file; leave `lib/tasks/cost.ts` itself untouched.

- [ ] **Step 5: Write a failing decimal-sum test**

In `actions/tasks/tasks.test.ts`, add a case next to the existing `totalCost` test that records assignment costs `12.50` and `7.25` and asserts `totalCost === 19.75`.

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: FAIL — the `::int` cast rounds the sum.

- [ ] **Step 7: Remove the integer casts**

In `actions/tasks/queries.ts:246-265`, change both sums to `sql<string>` with `coalesce(sum(...), 0)::text`. Convert with `Number(...)` when building the DTO at line 650 and in `getCostTotalByTaskId`. Do not round.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/schemas.test.ts actions/tasks/tasks.test.ts`
Expected: PASS.

- [ ] **Step 9: Verify the task**

Run: `pnpm verify`
Expected: PASS.

---

### Task 6: Project budget uses the money input

**Files:**
- Modify: `components/projects/project-form.tsx:238-245`

**Interfaces:**
- Consumes: `MoneyInput` from Task 4 via `<Field type="money">`.
- Produces: budget accepts decimals and emits a canonical decimal string into `ProjectFormValues.budget`.

- [ ] **Step 1: Change the field type**

In `components/projects/project-form.tsx`, change the Budget `Field` from `type="number"` to `type="money"`. Leave the surrounding grid, label, `value`, `onChange`, and `errors.budget` as they are. Do not pass `currency` or `locale` — the USD defaults apply in this plan.

- [ ] **Step 2: Verify the task**

Run: `pnpm verify`
Expected: PASS. The existing `budget: z.string().optional().default("")` schema already accepts a decimal string.

---

### Task 7: End-to-end decimal coverage

**Files:**
- Create: `e2e/decimal-money.spec.ts`

**Interfaces:**
- Consumes: the decimal behavior from Tasks 2–6.
- Produces: Playwright proof of decimal entry and display through real pages.

- [ ] **Step 1: Write the E2E spec**

Using `test`/`expect` from `./fixtures` and `signInAs("<role>")` with an appropriate role (owner or admin for project-scoped edits), cover:
- create a task with cost `12.50`, reload, and assert the input shows `$12.50` and the task row total shows the decimal
- set an expense amount to `10.75`, reload, and assert it persists
- set an invoice line-item unit price to `25.50` and assert the displayed total reflects it
- create a project with budget `1500.50` and assert the details page shows a decimal-formatted budget
- confirm an existing whole-number flow still displays `$150` (no `.00`)

- [ ] **Step 2: Run the E2E suite**

Run: `pnpm test:e2e`
Expected: PASS, including the existing whole-number `$150` assertions.

- [ ] **Step 3: Final verification**

Run: `pnpm verify`
Expected: PASS. Do not commit; ask the user first.
