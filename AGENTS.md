**NEVER commit or push changes without explicit user permission. Always ask first.**

# Alsia — Agent Guide

Invoicing and business-management web app: clients, sales/invoices, projects, products, activity, and reports. Next.js 16 App Router, React 19, TypeScript, PostgreSQL via Drizzle ORM, NextAuth v5, Tailwind CSS v4 + shadcn/ui, `next-intl`, `next-safe-action`, and Zod. Package manager: **pnpm**.

## Before Starting Any Task

**Always check for available related skills first.** Load the relevant skill using the `skill` tool before beginning work. This ensures you follow project-specific patterns and best practices.

Common triggers:

- **UI components** → load `shadcn`, `tailwind-css-patterns`, `frontend-design`
- **Next.js pages/routes** → load `next-best-practices`, `vercel-react-best-practices`
- **React components** → load `vercel-react-best-practices`, `vercel-composition-patterns`
- **Database/SQL** → load `drizzle-orm`, `supabase-postgres-best-practices`
- **Testing** → load `playwright-best-practices`
- **TypeScript types** → load `typescript-advanced-types`
- **Accessibility** → load `accessibility`
- **SEO** → load `seo`
- **Node.js backend** → load `nodejs-best-practices`, `nodejs-backend-patterns`

## Commands

- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint (targeted): `pnpm eslint <paths>` — full: `pnpm eslint --max-warnings=0`
- Types: `pnpm typecheck`
- Unit tests (watch): `pnpm test` — once: `pnpm test:run` — focused: `pnpm vitest run -t "<test name>"`
- Full verification: `pnpm verify` (typecheck + lint + tests with coverage)
- Generate migration: `pnpm db:generate` — apply: `pnpm db:migrate` — seed: `pnpm db:seed`

## Repository map

- `app/` — Next.js App Router routes; authenticated app lives under `app/app/`
- `actions/` — server actions (`actions/not-safe/` for plain actions without next-safe-action); Zod schemas in `actions/schemas/`
- `components/` — UI, grouped by route/domain; shadcn/ui primitives in `components/ui/`
- `stores/` — page-scoped optimistic Zustand stores, one folder per domain
- `hooks/` — shared React hooks and store infrastructure
- `lib/` — auth, Drizzle schema/client/migrations, utilities, types
- `messages/` — `next-intl` translations (`en.json`, `es.json`)
- `drizzle/` — generated SQL migrations (never hand-edit)
- `e2e/` — Playwright specs
- `docs/superpowers/specs/` — design docs, one per capability; `docs/superpowers/plans/` — implementation plans
- `.githooks/` — native git hooks (pre-commit runs `pnpm verify`); `.github/workflows/` — CI

## Project Conventions

- **Server actions** in `actions/` (safe actions via next-safe-action) and `actions/not-safe/` (plain server actions without next-safe-action) — auth-guarded, Zod validation via `actions/schemas/`, `revalidatePath` after mutations
- **Components** follow shadcn/ui patterns: `FieldGroup`/`Field` for forms, `data-invalid`/`aria-invalid` for validation, `cn()` for class merging
- **Database** via Drizzle ORM with PostgreSQL — schema in `lib/drizzle/schema.ts`
- **State** — page-scoped optimistic stores in `stores/<domain>/` — see the Optimistic Stores section
- **Auth** via NextAuth v5 — `auth()` from `@/lib/auth`
- **Icons** from `lucide-react`
- **Toasts** via `sonner`
- **Styling** Tailwind CSS v4 with semantic tokens — no raw colors or manual `dark:` overrides

### Translations

- `messages/en.json` and `messages/es.json` stay structurally identical — every key exists in both.
- **Before adding a key, check whether the term already exists.** Search `messages/` first and reuse the shared namespace: `common.*` for generic UI labels, `invoice.*` for invoice terms shared by `sales` and `myInvoices`, `nav.*` for route labels. Add a domain-specific key only when the label genuinely differs by context.
- Dynamic key-maps (`errors.*`, `sales.statuses.*`, `projects.status.*`, `projects.tasks.status.*`, `projects.tasks.priority.*`, `projects.colors.*`, `activity.*`, `activities.types.*`, `projects.routines.*`, `categoryNames.*`, `taxonomyNames.*`, `theme.*`) are looked up by value — never rename or merge their keys.

## Boundaries

Allowed without asking:

- Read, search, and edit files
- Run lint, type-check, and tests

Ask first:

- Anything that commits, pushes, or opens a PR (always)
- Installing or removing dependencies
- Deleting files or directories

Never:

- Commit secrets or `.env*` files — `.env.local` is gitignored; commit only `.env.example`
- Hand-edit `drizzle/` output: `drizzle/meta/_journal.json`, `drizzle/*.sql`, or `drizzle/meta/*_snapshot.json`
- Add `any` to work around type errors — fix the type instead
- Bypass the quality gate (`git commit --no-verify`) or weaken lint/coverage thresholds to make a change pass

## Verification

Run after finishing a change; fix failures before completing the task:

1. `pnpm verify` — `tsc --noEmit` + `eslint --max-warnings=0` + `vitest run --coverage` (floor: 60% lines/functions/statements, 50% branches)

Or use the `/verify` command, which runs the full suite. The pre-commit hook (`.githooks/pre-commit`) and CI (`.github/workflows/ci.yml`) both run `pnpm verify` — never bypass them.

## Drizzle Migration Workflow

**Always use `drizzle-kit generate`** to create migrations. Never manually edit migration files.

### Rules

1. Make schema changes in `lib/drizzle/schema.ts`
2. Run `pnpm db:generate` — creates SQL + snapshot together
3. Review the generated SQL for issues (NOT NULL without defaults, etc.)
4. Run `pnpm db:migrate` — applies to database
5. Run any data migration scripts if needed

### Why

Drizzle tracks migration state via snapshot files that must form a chain (`prevId` → `id`). Manual edits break this chain and cause silent failures.

## Optimistic Stores

**All list and mutation UI state lives in a page-scoped Zustand store — never in component `useReducer` or list `useState`.** The full contract is `docs/superpowers/specs/2026-10-16-optimistic-state-design.md`; read it before building or migrating a store. Copy the closest existing domain: `stores/expenses/` (whole-state list) or `stores/my-tasks/` (partial store with client-only slices).

### File layout

    stores/<domain>/
    ├── <domain>-reducer.ts        pure reducer + State/Action types
    ├── <domain>-store.ts          createXStore(), XStoreContext, useXStore() that throws
    ├── use-<domain>-state.ts      single no-arg state hook (the file's only export)
    ├── use-<domain>-actions.ts    every mutation: useOptimisticAction + useSettle
    └── <domain>-store.test.ts     vitest, beside the file it covers

    components/<route>/<domain>/<domain>-provider.tsx   ← lazy useState + useServerReseed
    app/app/<route>/page.tsx                            ← mounts the provider (never the view)

### Rules

1. **Reducer** — pure `switch` over a discriminated union; actions named by intent (`add`, `update`, `replaceTemp`, `delete`). No `reset`: failed mutations revert through `discard`, and whole-list replacement is `reseedFromServer`'s job.
2. **Store** — `createOptimisticStore({ initialState, reducer, serverSlice? })`. Omit `serverSlice` when state IS the server's list (a reseed replaces it wholesale); declare the key when state also holds client-only slices (loaded comments, fetched payments). Export the context and a `useXStore()` that throws a provider-named error.
3. **State hook** — one no-arg hook, the file's only export, selecting `s.optimistic` with `useStore`. Name values by domain (`routines`, never `optimistic`); put defaults and derivations here (`EMPTY_*`, `pendingIds`). No permissions — components compose `useProjectContextState()` facts with `useHasPermission()`.
4. **Actions hook** — every mutation runs through `run(action, execute, { commitAction })` from `useOptimisticAction`, reported via `useSettle`. `commitAction` issues `replaceTemp` to swap the temp row for the server row. Return `SettleResult` only when the caller consumes it, otherwise `void`. Fetch helpers pend/commit directly with no loading bar. Pass `projectId` and lookup data as explicit parameters — a store folder never imports a sibling store folder.
5. **Provider** — `const [store] = useState(() => createXStore(seed))` plus `useServerReseed(store, seed)`, published through the context. The page mounts it, so the consuming view stays a single component that reads the store. No `useRef`, no `eslint-disable`.
6. **View** — reads `useXState()`, calls `useXActions()`; dialog and form state stay local. Views never import mutations from `lib/actions/*` directly.
7. **Imports** — relative (`./x-reducer`) inside the folder, absolute (`@/stores/x/x-store`) outside. Shared infra stays at `stores/use-optimistic-action.ts` and `hooks/` (`use-server-reseed`, `use-settle`, `use-loading-indicator`).

### Never

- `useReducer` or a list in `useState` inside a component (routines was the last one; keep it that way)
- `create` from `zustand` (it returns a bound hook) or calling a store as a function — stores are vanilla `StoreApi`, read with `useStore` in render and `getState()` in async handlers
- `reset`/`hydrate` actions, or attaching methods with `Object.assign` after construction
- module-level singleton stores — one instance per provider per route visit
- conditional permission hooks (`isOwner && useHasPermission(...)`) or permission flags in a state hook
- a store folder importing a sibling store folder

### Adding or migrating a store

reducer → store → state hook → actions hook → test → provider → mount in the page → rewrite the view to use the hooks → verify with `/verify`.
