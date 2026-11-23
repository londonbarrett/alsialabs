# Project Country and Currency — Design

## Intent and why

Projects need to state the country they belong to so their money figures are
shown in that country's currency and formatting. Today a project has a single
free-text `location` field, and every money figure in the app is hardcoded to
USD. A project in Colombia has no way to say so, and its budget is always
labelled as dollars with US formatting.

This change adds a required `country` to each project, set in the create form
and editable through the existing project edit flow. It is shown on the project
details page and on project cards. **Currency is not stored** — it and the
number format are derived from the country, so money always carries a format
consistent with where the project is. Currency is a display unit, not a
conversion: the stored amount never changes.

## Goals

- Add a non-null `country` column to `projectsTable`, defaulting to Colombia.
- Derive both the currency code and the number-format locale from the country
  with one shared map, used everywhere project money is displayed.
- Offer Country as a select in the shared project create/edit form
  (`ProjectForm`), alongside the existing free-text Location field, which stays
  unchanged. Default it from the user's UI locale (`es → CO`, `en → US`).
- Show Country and the derived Currency on the project details card, and format
  the budget with the country's currency and locale.
- Show Country on project cards, and format the card's budget and spend figures
  with the country's currency and locale.
- Thread `country` through `actions/projects/` (schemas, queries, actions),
  both optimistic stores, and the en/es message files.
- Generate the migration with `pnpm db:generate`; never hand-edit `drizzle/`.
- Ship vitest coverage for the action/query path and the country map, and
  Playwright coverage for the create form, details page, and project card.

## Non-goals and anti-goals

- **No stored currency field and no currency selector.** One source of truth
  (country) prevents a project from ending up as "Colombia + USD". Adding a
  manual currency override later is a separate decision.
- **No currency conversion or exchange rates.** The stored number never
  changes; changing the country changes the label and the number format only.
  This applies to spend as well as budget: spend is a stored amount, not a
  converted one.
- **No change to the free-text Location field.** It remains required and stays
  in the same place in the form, details page, and cards. Country is additional
  information, not a replacement.
- **No structured address** (street, city, postal code, state/region).
- **No invoice changes.** Invoices keep their current behavior and USD
  formatting. No new invoice column, no inheritance of the project's currency
  into invoices, and no address on invoices.
- **No countries outside the Americas.** The country list covers the Americas,
  ordered north to south.
- **No per-user or per-store defaults beyond the form preselection.** The DB
  default is always Colombia.

## Constraints and existing patterns

- The schema uses plain `text` columns with a `$type<>()` TS union and an
  `as const` array — there is no `pgEnum` anywhere in this repo. Follow that:
  `PROJECT_COUNTRIES` and `ProjectCountry`. There is no `ProjectCurrency`
  column, but the derived currency type can still be a union of codes.
- The response schema must use the matching `z.enum(PROJECT_COUNTRIES)`, not
  `z.string()`: `project-details.tsx:54-70` assigns the `getProjectForEdit` DTO
  into `useState<DbProject | undefined>`, so `DbProject` and `ProjectRecordDTO`
  must agree on `country` exactly (the same reason `status` is a union on both
  sides today). No `as` cast or `any` is acceptable as a workaround.
- `PROJECT_COLORS` / `PROJECT_COLOR_NAME_KEYS` in
  `components/projects/colors.ts` are the precedent for a fixed option list
  consumed by both the server schema and the form. Put the new constants in a
  new `lib/projects/location.ts` so the server-side schema does not import from
  `components/` (the color import is a precedent to improve on).
- Authorization and action structure do not change. `createProject` is a
  `sessionAction`; `updateProject` is a `projectAction` guarded by
  `canManageProject`. No new permission code.
- All DB work lives in `actions/projects/queries.ts`. The new value must be
  added to the three explicit select lists (`getProjectOptions`,
  `getProjectsForUser`, `getProjectById`), the summary mapping in
  `getProjectSummaries`, and both `createProject`/`updateProject` queries.
- The form owns its fields in `useState` and builds a `ProjectFormValues`
  object; it calls `onSubmit(data)` and owns no mutation. The dialog wrapper
  needs no change. `useLocale()` from next-intl is available in this client
  component (it already uses `useTranslations()`).
- Detail state lives in `stores/project-context/` and list state in
  `stores/projects/`. The new field must be added to `toOptimisticPatch()` in
  `stores/project-context/use-project-actions.ts` and to `buildOptimisticProject`
  plus the commit mapping in `stores/projects/use-projects-actions.ts`.
- Translations live in `messages/en.json` and `messages/es.json` and must stay
  structurally identical. Reuse `common.location` and `common.budget`; add only
  genuinely new labels (Country, Currency, required message). Check first for
  an existing term — only `invoiceItem.currencyPrefix` exists today and it is
  not reusable here.
- `Money` (`components/common/money.tsx`) already accepts `currency` and
  `locale`, so no new formatting component is needed for the details page. The
  card has its own module-level `Intl.NumberFormat("en-US", { currency: "USD" })`
  at `project-card.tsx:64-68`; replace it with `Money` so the card and details
  page cannot drift.
- **Dependency:** `docs/superpowers/specs/2026-11-22-decimal-money-design.md`
  changes `Money` to use the currency's own fraction digits with a zero minimum
  (COP → `$150`, USD → `$150` whole / `$150.50` with cents) and makes
  `MoneyInput` decimal-aware. This design assumes that behavior and supplies
  the country's `currency` and `locale` to it; it does not define its own
  fraction-digit rule.

## Decisions

### Data model and migration

- `projects.country`: `text("country").notNull().default("CO").$type<ProjectCountry>()`.
  The column default both backfills every existing row to Colombia when the
  migration adds the column and supplies the value for any write that omits it.
  **No separate data-migration script is needed.**
- No `projects.currency` column. Currency and format locale are computed from
  `country` at read time and never persisted.
- The existing `projects.location` column is untouched.
- Generate the migration with `pnpm db:generate` (expected next number: 0031).
  Review the generated SQL to confirm `ADD COLUMN country text DEFAULT 'CO'
  NOT NULL` before applying — that single statement is the backfill.

### Country, currency, and locale constants (`lib/projects/location.ts`)

- `PROJECT_COUNTRIES`: every country of the Americas, ordered north to south —
  North America, Central America, the Caribbean, then South America. Concrete
  set to start from:
  - North/Central: `CA, US, MX, GT, BZ, HN, SV, NI, CR, PA`
  - Caribbean: `BS, CU, HT, DO, JM, PR, BB, TT`
  - South (north to south): `CO, VE, GY, SR, EC, PE, BR, BO, PY, CL, AR, UY`
  Include additional Caribbean nations commonly present in ISO lists (for
  example `AG, AW, CW, DM, GD, KN, LC, VC`) only if their currency/locale entry
  can be filled accurately. Exact membership and intra-region ordering are a
  builder call, but the list must span the whole Americas and use ISO 3166-1
  alpha-2 codes.
- `ProjectCountry = (typeof PROJECT_COUNTRIES)[number]`.
- `COUNTRY_FORMAT: Record<ProjectCountry, { currency: string; locale: string }>`
  mapping each country to its ISO 4217 currency code and the locale used to
  format numbers for that country. Every code in `PROJECT_COUNTRIES` must have
  an entry. Starting values:
  `CA → CAD/en-CA`, `US → USD/en-US`, `MX → MXN/es-MX`, `GT → GTQ/es-GT`,
  `BZ → BZD/en-BZ`, `HN → HNL/es-HN`, `SV → USD/es-SV`, `NI → NIO/es-NI`,
  `CR → CRC/es-CR`, `PA → PAB/es-PA`, `BS → BSD/en-BS`, `CU → CUP/es-CU`,
  `HT → HTG/ht-HT`, `DO → DOP/es-DO`, `JM → JMD/en-JM`, `PR → USD/es-PR`,
  `BB → BBD/en-BB`, `TT → TTD/en-TT`, `CO → COP/es-CO`, `VE → VES/es-VE`,
  `GY → GYD/en-GY`, `SR → SRD/nl-SR`, `EC → USD/es-EC`, `PE → PEN/es-PE`,
  `BR → BRL/pt-BR`, `BO → BOB/es-BO`, `PY → PYG/es-PY`, `CL → CLP/es-CL`,
  `AR → ARS/es-AR`, `UY → UYU/es-UY`.
- `DEFAULT_COUNTRY: ProjectCountry = "CO"`.
- `defaultCountryForLocale(locale: string): ProjectCountry` returns `CO` for
  `es` and `US` for `en`, falling back to `DEFAULT_COUNTRY`. This is only a form
  preselection; the DB default is always CO.
- `currencyForCountry(country: ProjectCountry): string` and
  `localeForCountry(country: ProjectCountry): string` read from `COUNTRY_FORMAT`,
  with runtime fallbacks of `"USD"` and `"en-US"` so bad seed data cannot crash
  a render.
- `projectMoneyProps(country: ProjectCountry): { currency: string; locale: string }`
  returns the pair from `COUNTRY_FORMAT`. Callers spread it into `Money` (or
  `formatMoney`) rather than building their own formatter, so the details page,
  cards, and money inputs all use the same currency and locale. Fraction digits
  come from the decimal-money design, not from this map.
- Country labels use `Intl.DisplayNames(locale, { type: "region" })` and
  currency labels use `Intl.DisplayNames(locale, { type: "currency" })`. This
  avoids dozens of hand-maintained translation keys and keeps names localized
  in both en and es. **This is my call**, made because the repo only has two
  locales; if you would rather have explicit `projects.countries.*` /
  `projects.currencies.*` keys like the color names use, that can be swapped in.
- The stored value is the country code, never the localized name. Sorting in
  the dropdown follows the list order (north to south), not the localized label.

### Form (`components/projects/project-form.tsx`)

- Add `country: ProjectCountry` to `ProjectFormValues`.
- Add `useState` initialized from `project?.country ?? defaultCountryForLocale(locale)`.
- Keep validation for country (required) with a new `projects.countryRequired`
  message, even though the default means it is normally set.
- Add one Country select using the same shadcn `Select` pattern already used
  for Category and Status. The existing Location/Budget grid absorbs it (for
  example Location + Country, then Budget). No currency control.
- Pass the derived currency/locale from `projectMoneyProps(country)` to the
  Budget `MoneyInput` so its decimal precision follows the country (see the
  decimal-money design).
- Submit `country` in the `ProjectFormValues` payload.

### Schemas (`actions/projects/schemas.ts`)

- `ProjectSchema`: add
  `country: z.enum(PROJECT_COUNTRIES).default(DEFAULT_COUNTRY)`.
- `CreateProjectSchema`/`UpdateProjectSchema` inherit it automatically.
- `ProjectRecordSchema`: add `country: z.enum(PROJECT_COUNTRIES)`.
- `ProjectSummarySchema` duplicates the field list — add `country` there too so
  the list store and cards receive it. `ProjectDetailSchema` and
  `ProjectOptionSchema` inherit from `ProjectRecordSchema` and need no change.
- Add the inferred DTO type to the existing type block; no `as` casts.

### Queries and actions (`actions/projects/`)

- Thread `country` through create/update `.values()`/`.set()` in `queries.ts`.
- Add `country` to the select lists and to `getProjectSummaries`' mapped rows.
- No new actions and no changes to existing action signatures beyond what the
  schema adds.

### Details page (`components/projects/project-details.tsx`)

- Keep the current card and its three-column grid. Add Country next to the
  existing Location and Budget entries; reuse `MapPin` for Country and a
  currency-appropriate lucide icon (for example `CircleDollarSign`) for the
  derived Currency entry.
- Render Country as the localized `Intl.DisplayNames` label.
- Render Currency read-only as the derived code plus its localized name, so the
  currency is explicit on the details page without being a second input.
- Format the budget with `<Money {...projectMoneyProps(project.country)} />`.
  Do not pass a UI-locale override — the country's locale is authoritative here.
- Do not change the location line under the project title in
  `components/projects/project-view.tsx`.

### Project cards (`components/projects/project-card.tsx`)

- Add a Country entry to the meta grid under the existing Location entry,
  using the same localized `Intl.DisplayNames` label as the details page.
- Remove the module-level `USD`/`en-US` formatter at lines 64-68. Format both
  `project.expenses` (spend) and `project.budget` with `<Money {...projectMoneyProps(project.country)} />`,
  keeping `tabular-nums` and the over-budget color treatment.
- Keep the spend/budget progress math exactly as it is — only the display
  format changes.

### Optimistic stores

- `stores/project-context/use-project-actions.ts`: add `country: values.country`
  to `toOptimisticPatch()` so edit updates immediately and matches the server.
- `stores/projects/use-projects-actions.ts`: add `country` to
  `buildOptimisticProject` and to the commit mapping from the returned row, so
  a card created optimistically shows the right country and currency from the
  start.
- No reducer changes: the value flows through the existing `patchProject` and
  `replaceTemp` cases.

### Translations

- Reuse `common.location` and `common.budget`.
- Add to **both** `messages/en.json` and `messages/es.json` with identical
  structure: a Country label, a Currency label (for the read-only details row),
  and `projects.countryRequired`.

### Tests

- `actions/projects/projects.test.ts`: cover create and update persisting
  `country`, the `.default("CO")` behavior when country is omitted, and the
  output schema returning `country`.
- Unit test `lib/projects/location.ts`: every `PROJECT_COUNTRIES` entry has a
  `COUNTRY_FORMAT` entry, `defaultCountryForLocale` returns CO for es, US for en
  and CO otherwise, and `projectMoneyProps` returns COP/es-CO for CO and
  USD/en-US for US.
- Store tests: cover the optimistic patch and optimistic create row carrying
  `country`.
- Playwright: create a project with country US, assert the details page and the
  card show United States / USD with US formatting; edit it to Colombia and
  assert both surfaces update to COP with es-CO formatting. Also assert a new
  project defaults to the locale-appropriate country.
- No e2e test for invoice behavior — invoices are unchanged.

## Left to the builder (sensible defaults; call them out when implementing)

- Exact membership and ordering of the Americas country list, and the exact
  country→currency/locale mapping. Keep it complete and accurate, ordered north
  to south.
- Whether the new form field sits in a three-column row or its own row; follow
  the surrounding grid spacing and keep it readable on narrow dialogs.
- Which lucide icon to use for the read-only Currency row.
- Whether the `Intl.DisplayNames` option labels live in
  `lib/projects/location.ts` or in a small companion helper module. Keep them in
  one place so the form, details page, and cards agree. Money formatting itself
  stays in the shared `Money` helper from the decimal-money design.
- Whether to update seed data in `lib/drizzle/seed.ts` / `seed-e2e.ts` so
  seeded projects exercise more than one country. Not required for the feature,
  but it makes the e2e assertions more meaningful.
