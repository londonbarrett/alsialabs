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
- E2E tests: `pnpm test:e2e` (boots the app on port 3100 with the Docker test DB; runs alongside `pnpm dev` on 3000)
- Generate migration: `pnpm db:generate` — apply: `pnpm db:migrate` — seed: `pnpm db:seed`

## Repository map

- `app/` — Next.js App Router routes; authenticated app lives under `app/app/`
- `actions/` — server actions, one folder per domain (`actions/<domain>/`); unmigrated flat actions live in `actions/legacy/`, plain server actions without next-safe-action in `actions/legacy/not-safe/`
- `components/` — UI, grouped by route/domain; shadcn/ui primitives in `components/ui/`
- `stores/` — page-scoped optimistic Zustand stores, one folder per domain
- `hooks/` — shared React hooks and store infrastructure
- `lib/` — auth, Drizzle schema/client/migrations, utilities, types
- `messages/` — `next-intl` translations (`en.json`, `es.json`)
- `drizzle/` — generated SQL migrations (never hand-edit)
- `e2e/` — Playwright specs
- `docs/superpowers/specs/` — design docs, one per capability; `docs/superpowers/plans/` — implementation plans
- `.githooks/` — native git hooks (pre-commit runs `pnpm verify` + `pnpm test:e2e`); `.github/workflows/` — CI

## Project Conventions

- **Server actions** — one folder per domain under `actions/<domain>/`; see the Server Actions section. Plain actions without next-safe-action stay in `actions/legacy/not-safe/` until their domain migrates
- **Components** follow shadcn/ui patterns: `FieldGroup`/`Field` for forms, `data-invalid`/`aria-invalid` for validation, `cn()` for class merging
- **One component per file** — split components into separate files; a file holds a single component
- **Event handlers** — memoized with `useCallback` when the body is two lines or more; single-line handlers may stay inline
- **Database** via Drizzle ORM with PostgreSQL — schema in `lib/drizzle/schema.ts`
- **Types** — shared types used in several places live in `lib/types.ts`; exceptions: `ComponentProps` stay with their component, DTOs stay with their schemas in `actions/<domain>/schemas.ts`. As a rule of thumb, if a type is going to be used in several places, it belongs in `lib/types.ts`.
- **State** — page-scoped optimistic stores in `stores/<domain>/` — see the Optimistic Stores section
- **Auth** via NextAuth v5 — `auth()` from `@/lib/auth`
- **Icons** from `lucide-react`
- **Toasts** via `sonner`
- **Styling** Tailwind CSS v4 with semantic tokens — no raw colors or manual `dark:` overrides

### Translations

- `messages/en.json` and `messages/es.json` stay structurally identical — every key exists in both.
- **Before adding a key, check whether the term already exists.** Search `messages/` first and reuse the shared namespace: `common.*` for generic UI labels, `invoice.*` for invoice terms shared by `sales` and `myInvoices`, `nav.*` for route labels. Add a domain-specific key only when the label genuinely differs by context.
- Dynamic key-maps (`errors.*`, `sales.statuses.*`, `projects.status.*`, `projects.tasks.status.*`, `projects.tasks.priority.*`, `projects.colors.*`, `activity.*`, `activities.types.*`, `projects.routines.*`, `categoryNames.*`, `taxonomyNames.*`, `theme.*`) are looked up by value — never rename or merge their keys.

## Server Actions

**Every domain lives in one folder under `actions/<domain>/`.** Background: `docs/superpowers/specs/2026-10-16-safe-actions-design.md` (client chains, auth, metadata, revalidation) and `docs/superpowers/specs/2026-10-16-action-response-schemas-design.md` (output schemas, DTO inference). Domains not yet migrated sit under `actions/legacy/` (with plain server actions in `actions/legacy/not-safe/`) and migrate one per session — the rules below describe the target layout.

### File layout

    actions/<domain>/
    ├── index.ts       barrel: named re-exports from ./actions only — NO "use server" (Turbopack rejects re-exports in a "use server" file; the directive on actions.ts is what marks the functions as server references)
    ├── actions.ts     "use server" — safe actions (next-safe-action chains)
    ├── queries.ts     every DB read/write for the domain; default-exports an object of query functions; NO "use server"
    ├── schemas.ts     all Zod input + output schemas and inferred *DTO types; NO "use server"
    ├── util.ts        internal helpers used by actions but never exported to the client; NO "use server"; never re-exported from index.ts
    └── *.test.ts      vitest, beside the file it covers

Shared non-DTO types do not live in the module — see the Types convention below (`lib/types.ts`).

### Rules

1. **`"use server"` only on `actions.ts`.** On `index.ts` it would make every re-export fail the build (Turbopack: "Only async functions are allowed to be exported in a `"use server"` file"); on `queries.ts`/`util.ts` it would turn every export into a browser-callable endpoint (this is the `verifyProjectAccess` role-probe bug the layout fixes). The barrel `index.ts` re-exports from `actions.ts` without the directive.
2. **No direct DB queries inside actions.** `actions.ts` never imports `@/lib/drizzle/client` or `drizzle-orm` — it calls `queries.ts`. **A leaf query is exactly one DB call; a composed query contains zero direct `db` calls and only calls other queries** (e.g. `getProjectMembers` calls `getProjectPrimaryOwnerId` + `getUserById` + `getProjectMembershipRows`). The sole exception is a `db.transaction(...)`, which is one atomic unit.
3. **Action and query naming is `[action][subject]`, plus a condition when needed** — `getProjectById`, `getProjects`, `createProject`, `updateProject`, `deleteProject`, `transferProjectOwnership`. Skip the condition when it's obvious from the subject (`getProjects`, not `getProjectsList`).
4. **Ship the typical CRUD per module only where it's used** — `getResources`, `getResourceById`, `createResource`, `updateResource`, `deleteResource`. Never add an unused operation (no `patchResource` without a caller) and never a delete-all (`deleteResources`).
5. **Action body order:** read `ctx` → permission guard (`canManageProject`, `canViewProject`, or `metadata.permission` via the client) → call queries → map `null`/`undefined` to `returnActionError("NOT_FOUND")` / `throwActionError(...)` → return the row.
6. **Actions never call sibling safe actions.** Same-domain data comes through `queries.ts` directly (no nested wrapping, no `unwrapResponse` for same-module results). Calling another domain's action + `unwrapResponse` is allowed only until that domain migrates.
7. **`util.ts` is for helpers used by actions (or other internal code) but not exposed to the client** — e.g. `resolveProjectAccess`. If the client needs it, it's an action instead. Never re-export `util.ts` from the barrel.
8. **Schemas** — one `schemas.ts` per domain. Every action declares `.inputSchema(...)` (or an inline `z.object`) and `.outputSchema(...)` — including void mutations (`SuccessSchema`). Consumers infer with `import type { XDTO } from "@/actions/<domain>/schemas"`; never `Awaited<ReturnType<...>>`, never `as` casts on `result.data`.
9. **Client chain** — pick the narrowest that fits: `sessionAction` (session), `projectAction(schema)` (session + project access + `ctx.projectRole`), `storeAction`, `adminAction`. Domain rules (`canManageProject` etc.) are enforced in the body, not the chain. `metadata.revalidate` uses templates (`"/app/proyectos/:projectId"`) interpolated after commit; `metadata.permission` only when a global module code gates the action.
10. **Imports** — inside the folder: default import for queries (`import queries from "./queries"`, called as `queries.getProjectById(...)` — avoids name collisions with same-named actions), named for schemas/util. Absolute from outside: the barrel `@/actions/<domain>` for actions, explicit files for everything else (`@/actions/<domain>/schemas`, `@/actions/<domain>/util`).
11. **Tests** live beside the code, mock `@/lib/drizzle/client` with `vitest-drizzle-mock`, and mock module helpers by their new path (`vi.mock("@/actions/<domain>/util", () => ({ resolveProjectAccess: vi.fn() }))`).

### Action body template

    // actions/<domain>/actions.ts
    "use server"

    import queries from "./queries"
    import { SomeInputSchema, SomeOutputSchema } from "./schemas"
    import { sessionAction, returnActionError } from "@/actions/safe-action"

    export const getSomeThing = sessionAction
      .metadata({})
      .inputSchema(SomeInputSchema)        // omit for no-input reads
      .outputSchema(SomeOutputSchema)      // always declared
      .action(async ({ parsedInput, ctx }) => {
        const row = await queries.getThingById(parsedInput.id)
        if (!row) returnActionError("NOT_FOUND")
        return row                          // validated against outputSchema
      })

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

## Testing

- **E2E** (`e2e/*.spec.ts`, Playwright) — proves functionality works all together; drive it through the Next.js pages a user would interact with, never by invoking actions or helpers directly.
- **Server actions and util functions** — covered by vitest unit tests (beside-file `*.test.ts`, including `actions/<domain>/`; legacy locations `actions/legacy/*.test.ts` and `actions/__tests__/` until their domain migrates), not by e2e.
- **Auth in e2e** — import `test`/`expect` from `./fixtures`, not `@playwright/test`, and call `signInAs("<role>")` (see `TEST_USERS`) for an authenticated context.
- **Every behavioral change ships with tests** — superpowers adds e2e and/or unit coverage alongside features, fixes, and behavior edits; docs/config-only changes are exempt.

## Verification

Run after finishing a change; fix failures before completing the task:

1. `pnpm verify` — `tsc --noEmit` + `eslint --max-warnings=0` + `vitest run --coverage` (floor: 60% lines/functions/statements, 50% branches)
2. `pnpm test:e2e` — Playwright smoke suite (requires Docker: the pre-commit hook runs both)

Or use the `/verify` command, which runs the full suite. The pre-commit hook (`.githooks/pre-commit`) runs `pnpm verify` + `pnpm test:e2e` — never bypass it; CI (`.github/workflows/ci.yml`) runs `pnpm verify`.

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
