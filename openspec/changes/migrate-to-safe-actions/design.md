## Context

22 server action files in `lib/actions/` each manually repeat: `"use server"` directive, `getActionT()` for i18n, `try { requirePermission() } catch {}`, `schema.safeParse()`, uniqueness checks, DB operations, `revalidatePath()`, and return `{ success: true/false }` wrappers. Client components use 4 different patterns for calling actions with duplicated loading state and error handling logic. A `useServerAction` hook was built but never used.

## Goals / Non-Goals

- Goals: eliminate boilerplate via middleware, standardize action contracts, enable optimistic updates on all actions, create testable business logic foundation, incremental migration
- Non-Goals: rewrite all components at once (incremental per domain), add E2E tests (focus on unit tests), change the UI/UX, migrate to a different ORM or auth system

## Decisions

### Action client hierarchy

Five clients form an inheritance chain, each adding one middleware layer:

```
actionClient (logging)
  ├── basicAction (permission + revalidation)
  │     ├── storeAction (+ getEffectiveStoreId)
  │     └── ownershipAction (+ auth + isSuperUser)
  │           └── projectAction (+ verifyProjectAccess, post-validation)
  └── adminAction (auth + isSuperUser, no permission system)
```

Each domain picks exactly the client it needs. Mutations typically use `basicAction`. Store-scoped queries use `storeAction`. Ownership-gated queries use `ownershipAction` or `projectAction`. Admin-only endpoints use `adminAction`.

### Metadata-driven middleware

Each action declares metadata that the middleware reads:

```ts
metadata({
  permission: { module: "categories", action: "create" },
  revalidate: ["/dashboard/categories"],
  tag: "permissions", // optional, for updateTag
})
```

The permission middleware calls `requirePermission()` if `permission` is present. The post-action middleware calls `revalidatePath()` for each path and `updateTag()` if tag is present. This replaces the manual calls currently scattered across every action.

### Separate create/update instead of upsert

Current `upsertCategory(data, taxonomyId, id?)` becomes `createCategory(data, taxonomyId)` and `updateCategory(data, taxonomyId, id)`. This gives each action a fixed permission in metadata (no dynamic `id ? "edit" : "create"`), cleaner input schemas, and makes optimistic updates straightforward (each action has a single optimistic shape).

### Error codes instead of translated strings

Server actions return `UPPERCASE_CODE` constants (e.g., `{ code: "FORBIDDEN" }`) via `returnServerError()`. Validation errors return codes in the `_errors` array (e.g., `{ email: { _errors: ["EMAIL_ALREADY_EXISTS"] } }`). The client translates codes to localized messages via `useActionError()`.

This removes `getActionT()` from server actions entirely — no i18n on the server for errors. The `actions.*` namespace in translation files is replaced by an `errors.*` namespace keyed by UPPERCASE codes.

### Optimistic-first design

All actions are designed to return data that enables optimistic updates:
- Create actions return the created entity (or at minimum `{ id, name }`)
- Update actions return the updated fields
- Delete actions return nothing (optimistic remove by id)

Components use `useOptimisticAction` with `currentData` from server-component props and an `optimisticFn` that adds/patches/removes items. `router.refresh()` syncs real state after the server response.

Components that currently fetch data client-side (e.g., task-comments-panel) shift to receiving data as props from server components, which is the prerequisite for `useOptimisticAction`.

### Unit test strategy

Vitest for server action unit tests. Each domain gets tests for:
- Happy path (create/update/delete succeeds)
- Permission denied (returns FORBIDDEN code)
- Validation failure (returns field error codes)
- Business logic errors (uniqueness conflicts, not found, etc.)

DB layer is mocked via Vitest mocks. Auth is mocked via `vi.mock("@/lib/auth")`. No E2E tests in this change.

### Query optimizations during migration

While rewriting each domain, apply these fixes:

- **Batch N+1 inserts**: `sales.ts` line items and `permissions.ts` permission inserts currently loop with individual `db.insert()` calls. Replace with single batch `db.insert().values([...])`.
- **Eliminate fetch-all-then-filter**: `projects.ts` `getProjects`/`getProjectsWithDetails` fetch ALL projects then filter in JS via `getUserProjectIds()`. Push the `WHERE IN` into SQL.
- **Combine sequential queries**: `clients.tsx` `upsertClient` makes 2 DB calls where 1 suffices (phone check + userId fetch). `inviteClient` has 4 sequential queries where first 2 can be `Promise.all`. `users.tsx` `updateUser` queries `rolesTable` 3 times where 1 suffices.
- **Minimize SELECT columns**: `project-access.ts` `verifyProjectAccess` uses `select()` (all columns) for existence checks on a hot path. Use minimal column selection or `sql<boolean>\`true\``.
- **Shared query helpers**: Extract `buildStoreCondition(table, storeId?)` and `getRoleIdByName(name)` into `lib/util/query-helpers.ts` to eliminate duplicated logic across 8+ files.

### Database indexes

Add indexes on ~14 foreign key columns that lack them. PostgreSQL does not auto-create indexes on FK columns. High-traffic tables affected: `tasks`, `task_comments`, `invoice_items`, `invoice_payments`, `client_activities`, `client_reminders`, `expenses`, `invoices`, `clients`, `products`.

### Narrowed revalidation

Current revalidation is overly broad in several domains:
- `activities.ts` revalidates `/dashboard/clients` for all activity changes — should revalidate `/dashboard/clients/${clientId}` + `/dashboard/activity`
- `reminders.ts` revalidates `/dashboard/clients` — should revalidate `/dashboard/clients/${clientId}`
- `sales.ts` revalidates `/dashboard/sales` for all invoice mutations — should also revalidate `/dashboard/sales/${invoiceId}` for detail pages
- `projects.ts` revalidates `/dashboard/projects` but not `/dashboard/projects/${id}` for detail pages

## Risks / Trade-offs

- [Breaking change in result shape] → All client components must be updated in the same domain migration. Mitigated by incremental per-domain approach — each domain is fully migrated before moving to the next.
- [Error code namespace change] → Translation keys shift from `actions.categories.forbidden` to `errors.FORBIDDEN`. The mapping is straightforward but touches both message files.
- [Components need data-as-props for optimistic] → Some components (task-comments-panel) currently fetch client-side. They need to shift to server-component props, which is a structural change beyond just swapping the action call.
- [Post-action revalidation in middleware] → `revalidatePath` runs for every successful mutation via metadata. Actions that conditionally revalidate (e.g., activities revalidating two paths) declare both paths in metadata. Actions that don't revalidate (e.g., task-comments) omit the field.
- [Dual revalidation for permissions/users] → These actions call both `revalidatePath` and `updateTag`. Both are supported via metadata fields `revalidate` and `tag`.
- [Database index migration] → Adding indexes on large tables could take time in production. Consider `CREATE INDEX CONCURRENTLY` if tables are large.
- [Query refactoring risk] → Changing "fetch-all-then-filter" to SQL WHERE IN changes the query shape. Must verify the same results are returned, especially for edge cases like empty project lists.
