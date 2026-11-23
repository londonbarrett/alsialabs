# Decimal Money Input — Design

## Intent and why

Every money column is already `numeric(12, 2)` and can store cents, but
`MoneyInput` strips everything after the decimal point and emits digits only.
Users can therefore never enter a fractional amount in a budget, task cost,
assignment cost, expense, invoice line item, payment, or paid amount. This
design makes money input decimal-aware, with the number of decimals determined
by the currency.

This supersedes the "digits only / whole units" non-goals in
`docs/superpowers/specs/2026-10-16-money-input-design.md` and
`docs/superpowers/specs/2026-11-22-task-costs-design.md`. Those documents remain
accurate about the *format-as-you-type* behavior; only the integer restriction
is lifted.

## Goals

- Let every `MoneyInput` field accept and display fractional amounts, using the
  currency's own maximum fraction digits (COP 0, USD/EUR 2, and so on).
- Keep whole amounts looking the way they do today: `$150`, not `$150.00`, even
  for USD. Cents appear only when the user enters them.
- Emit a canonical decimal string with `.` as the separator from `MoneyInput`
  (for example `"150.50"`), so zod schemas and Drizzle can consume it directly.
- Make the display helpers (`Money`, `formatMoney`) and the task cost pipeline
  (zod regex, DB sum casts, form normalization) decimal-safe.
- Keep the stored value as entered; never round to currency digits on write.

## Non-goals and anti-goals

- **No database migration.** All money columns are already `numeric(12, 2)`.
  If a larger scale is ever needed, that is a separate migration.
- **No currency conversion, exchange rates, or symbol selection.** The
  currency is a display/formatting input supplied by the caller.
- **No negative amounts.** The existing rejection of `-` stays.
- **No change to invoice total calculations** (`lib/util/invoices.ts`,
  `actions/invoices/queries.ts`) — they are already decimal-aware and store
  two-decimal strings.
- **No change to `formatCurrency`.** Invoice views keep their current two-digit
  display. This design changes `Money` and `formatMoney`, which are the display
  paths for project costs and expenses.
- **No rounding of an entered value to the currency's digit count.** A COP
  field normally allows 0 decimals, but a value with decimals is still stored
  as entered; formatting decides how it is shown.

## Scope boundary

This design is standalone and does **not** include the project country feature
in `docs/superpowers/specs/2026-11-22-project-location-currency-design.md`.
Until that feature lands, every money input keeps the `USD`/`en-US` default —
including the project budget, task cost, assignment cost, and expense amount.
When the country feature lands, those call sites pass the derived currency and
locale; nothing in this design needs to change for that to work. E2E coverage
here asserts decimal behavior under the USD default only.

## Constraints and existing patterns

- `MoneyInput` (`components/common/money-input.tsx`) parses with
  `parseInteger` (`value.split(".")[0]` then strips non-digits) and formats with
  `Intl.NumberFormat` at `minimumFractionDigits: 0, maximumFractionDigits: 0`.
  It emits a digit-only `onChange` string and uses `inputMode="numeric"`.
- `Field type="money"` (`components/form-field.tsx:27-33`) already forwards
  `currency` and `locale` props to `MoneyInput`; most call sites do not pass
  them, so the default is `USD`/`en-US`.
- `Money` (`components/common/money.tsx:5-10,40-50`) has a USD-specific
  `defaultFormatter` and otherwise passes `minimumFractionDigits: 0,
  maximumFractionDigits: 2` explicitly, overriding currency defaults.
- `lib/util/money.ts`: `formatMoney` and `parseMoney` strip all non-digits,
  so `"12.50"` becomes `"1250"`. `formatQuantity` and `formatCurrency` already
  use `parseFloat` and are decimal-safe.
- `CostInputSchema` (`actions/tasks/schemas.ts:20-29`) uses `^\d*$` and is
  reused by `TaskFormBaseSchema.cost` and `UpdateAssignmentCostSchema.cost`;
  a separate unit test currently asserts that decimals are rejected.
- `task-form.tsx:62-64` normalizes the DB string with
  `String(costToNumber(task.cost))`, turning `"150.00"` into `"150"` so it
  passes the old regex.
- `actions/tasks/queries.ts:250,260` cast summed costs to `::int`, which rounds
  the total to the nearest whole unit in Postgres.
- Money-input call sites: expense amount (`expense-form.tsx:134-141`), task cost
  (`task-form-details-step.tsx:76-81`), assignment cost
  (`assignment-cost-input.tsx:68-73`), invoice paid amount
  (`invoice-form.tsx:506-520`), payment amount (`payment-form.tsx:63-68`), and
  invoice line item unit price (`line-items-row.tsx:130-135`).
- Invoice quantity/percent fields already use `type="number" step="any"` and
  accept decimals; only the money inputs are restricted.

## Decisions

### Fraction digits

- Add a shared helper in `lib/util/money.ts`:
  `currencyFractionDigits(currency: string, locale = "en-US"): number` returns
  `new Intl.NumberFormat(locale, { style: "currency", currency })
  .resolvedOptions().maximumFractionDigits`.
- The input and display rules are **max = currency fraction digits; min = 0 for
  a whole value, max when the value has a fractional part**. This gives `$150`
  for a whole USD amount, `$150.50` when cents are present, and `$150` for COP.
  A single `Intl.NumberFormat` with `minimumFractionDigits: 0` would render
  `$150.5`, so formatters must choose the minimum based on whether the parsed
  value has a non-zero fractional part.
- Cache the `Intl.NumberFormat` instances in a small module-level map so
  repeated renders do not reconstruct them.

### `MoneyInput` (`components/common/money-input.tsx`)

- Replace `parseInteger`/`formatInteger` with decimal-aware equivalents.
- Determine the allowed decimal count from `currencyFractionDigits(currency,
  locale)`, capped at 2 (the DB scale).
- Parsing must distinguish grouping separators from decimal separators using
  the supplied locale's `Intl.NumberFormat(...).formatToParts()` output, so a
  formatted `1.500,50` (es-CO) parses to the canonical string `"1500.50"`.
  Accept `.` and `,` as decimal separators; the emitted value always uses `.`.
- Allow a trailing decimal separator while typing (`"150."`), so the user can
  type cents. **The displayed value keeps the trailing separator** (`"$150."`)
  until the next digit arrives — if the formatter dropped it, typing `5` after
  `150.` would be read as `1505` and cents could never be entered. The emitted
  value may therefore be `"150."`; the zod regex below accepts it and
  `parseFloat` handles it. **This is my call.**
- Keep the existing cursor-preservation effect, adapted to count digits before
  the caret and ignore separators.
- Change `inputMode` from `"numeric"` to `"decimal"`.
- The component still emits a string; no numeric type is introduced.

### Display helpers

- `Money` (`components/common/money.tsx`): remove the USD-specific
  `defaultFormatter`. When fraction props are not supplied, delegate to
  `formatMoney` so whole values show no cents and fractional values show the
  currency's full digit count. Explicit props still win. Keep the `null`/`NaN`
  fallback behavior unchanged.
- `lib/util/money.ts`: rewrite `formatMoney` and `parseMoney` to be
  decimal-safe. `parseMoney` returns a canonical `.`-separated decimal string,
  caps decimals at `min(currencyFractionDigits, 2)`, and gains an optional
  second argument `options?: { locale?: string; currency?: string }` (defaults
  `en-US`/`USD`), so existing single-argument callers keep working while es-CO
  parsing is testable. `formatMoney` formats with max from
  `currencyFractionDigits` and min `0` for whole values or max when a fractional
  part is present. The separator-detection logic used by `MoneyInput` lives
  here, in one shared helper, not duplicated in the component.
- Leave `formatCurrency` and `formatQuantity` as they are.

### Server validation and aggregation

- `actions/tasks/schemas.ts`: relax `CostInputSchema` to
  `^\d*(?:\.\d{0,2})?$` (still rejecting negatives and letters, allowing up to
  two decimals and a trailing separator). The message key `INVALID_COST` stays.
- `components/projects/tasks/task-form.tsx`: stop rewriting the DB string via
  `String(costToNumber(...))`; initialize from `task?.cost ?? ""`. A stored
  `"150.00"` already satisfies the relaxed regex.
- `actions/tasks/queries.ts:250,260`: remove the `::int` cast on the summed
  cost, read it as a string, and convert to the DTO's number type with
  `Number(...)` at the mapping boundary. Do not round.
- Leave `costToNumber` in `lib/tasks/cost.ts` in place for other consumers; it
  is no longer used for form initialization.

### Passing currency to the inputs

- `MoneyInput` keeps `currency = "USD"` as its default, so call sites do not
  all have to change at once.
- **Convert the project budget field** at `components/projects/project-form.tsx:238-245`
  from `<Field type="number">` to `<Field type="money">`. It is a money field
  like the others and cannot accept decimals today. Under this design it uses
  the USD default; the country design later passes the derived currency.
- All money inputs — project budget, task cost, assignment cost, expense
  amount, invoice paid amount, payment amount, and invoice unit price — use the
  `USD`/`en-US` defaults for now, including the project-scoped ones.
- This is the hook point for the project country feature: once
  `currencyForCountry(country)` exists in `lib/projects/location.ts`, the
  project-scoped call sites pass it. Nothing in this design requires storing
  currency per row.

### Tests

- Unit tests for the new `lib/util/money.ts` helpers: fraction digits for USD
  (2) and COP (0); canonical parsing of `"1.500,50"` in es-CO to `"1500.50"`;
  `formatMoney`/`Money` showing `$150` for whole USD and `$150.50` with cents.
- Add `jsdom` and `@testing-library/react` (plus `@testing-library/user-event`
  if needed for realistic typing) as dev dependencies, and configure Vitest
  with a jsdom environment for component tests (either project-wide with
  `environmentMatchGlobs` or via a `// @vitest-environment jsdom` docblock in
  the component test file). This was chosen deliberately over pure-helper-only
  tests so that `MoneyInput` typing and cursor behavior can be unit-tested.
- Add a `MoneyInput` component test covering: entering an integer, entering a
  decimal (`150.50` → emitted `"150.50"`), the trailing-separator case
  (`150.` stays visible and the next digit becomes cents), a zero-fraction
  currency (COP ignores an attempted decimal), and cursor preservation when
  editing the middle of a formatted value.
- Still extract the parse/format logic into the pure helpers in
  `lib/util/money.ts` and test those directly in Node (including es-CO
  separator detection), so the core logic has fast, focused coverage.
- Update `actions/tasks/schemas.test.ts`: decimals are now accepted (including
  `"12.50"` and `"12."`), negatives and letters are still rejected.
- Update `actions/tasks` query tests so a summed decimal cost is not rounded.
- E2E: enter a decimal task cost, expense amount, and invoice unit price, then
  reload and assert the fractional value persists and displays. Existing
  whole-number assertions (`$150`) remain valid.

## Left to the builder (sensible defaults; call them out when implementing)

- Exact parsing strategy for locale-aware separators, including how to handle
  a value with more decimals than the currency allows (truncate vs reject the
  extra keystroke) — truncate at the input layer is the sensible default.
- Whether to cap at 2 decimals for every currency or trust
  `currencyFractionDigits` fully; the DB scale is 2, so cap at 2.
- Whether to add a `currency` prop to `Field` call sites that currently omit it
  in one pass or incrementally. Pass it wherever the project country is known.
- Whether to add a short note to the two older design docs pointing at this
  one, rather than editing their historical text.
