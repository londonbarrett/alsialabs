**NEVER commit or push changes without explicit user permission. Always ask first.**

# Development Workflow

## Before Starting Any Task

**Always check for available related skills first.** Load the relevant skill using the `skill` tool before beginning work. This ensures you follow project-specific patterns and best practices.

Common triggers:
- **UI components** → load `shadcn`, `tailwind-css-patterns`, `frontend-design`
- **Next.js pages/routes** → load `next-best-practices`, `vercel-react-best-practices`
- **React components** → load `vercel-react-best-practices`, `vercel-composition-patterns`
- **Database/SQL** → load `supabase-postgres-best-practices`
- **Testing** → load `playwright-best-practices`
- **TypeScript types** → load `typescript-advanced-types`
- **Accessibility** → load `accessibility`
- **SEO** → load `seo`
- **Node.js backend** → load `nodejs-best-practices`, `nodejs-backend-patterns`

## Project Conventions

- **Server actions** in `lib/actions/` — auth-guarded, Zod validation, `revalidatePath` after mutations
- **Components** follow shadcn/ui patterns: `FieldGroup`/`Field` for forms, `data-invalid`/`aria-invalid` for validation, `cn()` for class merging
- **Database** via Drizzle ORM with PostgreSQL — schema in `lib/drizzle/schema.ts`
- **State** — page-scoped optimistic stores in `stores/<domain>/` — see the Optimistic Stores section
- **Auth** via NextAuth v5 — `auth()` from `@/lib/auth`
- **Icons** from `lucide-react`
- **Toasts** via `sonner`
- **Styling** Tailwind CSS v4 with semantic tokens — no raw colors or manual `dark:` overrides

## Drizzle Migration Workflow

**Always use `drizzle-kit generate`** to create migrations. Never manually edit migration files.

### Rules
1. Make schema changes in `lib/drizzle/schema.ts`
2. Run `npx drizzle-kit generate` — creates SQL + snapshot together
3. Review the generated SQL for issues (NOT NULL without defaults, etc.)
4. Run `npx drizzle-kit migrate` — applies to database
5. Run any data migration scripts if needed

### Never
- Manually edit `drizzle/meta/_journal.json`
- Manually create `.sql` files in `drizzle/`
- Manually create `_snapshot.json` files in `drizzle/meta/`
- Change schema after generating (regenerate if you do)

### Why
Drizzle tracks migration state via snapshot files that must form a chain (`prevId` → `id`). Manual edits break this chain and cause silent failures.

## Optimistic Stores

**All list and mutation UI state lives in a page-scoped Zustand store — never in component `useReducer` or list `useState`.** The full contract is `openspec/specs/optimistic-state/spec.md`. When building or migrating a store, copy the closest existing domain: `stores/expenses/` (whole-state list) or `stores/my-tasks/` (partial store with client-only slices).

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

### Why
Pending actions render instantly and auto-revert on failure: `pend`/`commit`/`discard` keep `optimistic` = committed + pending, applied in order. `useOptimisticAction` runs the mutation, commits or discards, drives the global loading bar, and calls `router.refresh()` — the fresh server props reach the store through `useServerReseed`, which replays still-pending actions over the new data, so a focus refresh never discards an in-flight write. A test beside each store locks the commit/discard/reseed semantics.

### Adding or migrating a store
reducer → store → state hook → actions hook → test → provider → mount in the page → rewrite the view to use the hooks → verify with `npx tsc --noEmit`, targeted `npx eslint`, `npx vitest run`, `npx openspec validate --specs`.
