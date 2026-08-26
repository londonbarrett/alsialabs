## Why

Server actions across 22 files repeat identical boilerplate: auth guards, validation, error handling, revalidation, and i18n setup. There are 4 distinct client-side patterns for calling actions (manual useState, useTransition, useOptimistic, form action) with no consistent error handling. A dedicated `useServerAction` hook exists but was never adopted. This duplication makes every new feature slower to build and harder to test.

The goal is to adopt `next-safe-action` to eliminate boilerplate, standardize the action contract, enable optimistic updates everywhere, and create a foundation for unit testing business logic.

## What Changes

- Install `next-safe-action` and `vitest`
- Create `lib/safe-action.ts` with 5 action clients: `basicAction`, `storeAction`, `ownershipAction`, `projectAction`, `adminAction` — each adding a layer of middleware (permission, store scoping, ownership, project access)
- Create `lib/actions/error-codes.ts` with `UPPERCASE_CODE` constants for all action errors
- Create `lib/util/action-errors.ts` with a client-side `useActionError()` hook that maps codes to translated messages
- Create `lib/util/query-helpers.ts` with shared DB utilities (store-scoped conditions, role lookups) to eliminate duplicated logic across 8+ files
- Create `vitest.config.ts` and `lib/__tests__/` for server action unit tests
- Convert all 22 server action files: split `upsert*` into separate `create*` and `update*` actions, replace manual boilerplate with metadata-driven middleware, return data directly instead of `{ success, error }` wrappers
- Optimize actions during migration: batch N+1 inserts (sales line items, permissions), eliminate fetch-all-then-filter queries (projects), combine sequential queries (clients, users), reduce redundant role lookups
- Add missing database indexes on ~14 foreign key columns (tasks.projectId, invoiceItems.invoiceId, etc.)
- Narrow overly broad revalidation paths (activities, sales, reminders)
- Update all client components: replace manual useState/try/catch with `useAction` or `useOptimisticAction` hooks, replace `result.error` string display with `translate(code)` pattern
- Add unit tests for every converted action domain

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `client-crud`: Server actions use safe-action clients; components use `useAction`/`useOptimisticAction` hooks
- `category-management`: Same pattern as client-crud
- `project-management`: Actions use `projectAction` client; components use safe-action hooks
- `user-management`: Actions use `adminAction` client
- `sales`: Actions use `ownershipAction` client
- All other action domains follow the same migration pattern

## Impact

- `lib/safe-action.ts` — new file, core infrastructure
- `lib/actions/error-codes.ts` — new file, all error constants
- `lib/util/action-errors.ts` — new file, client-side error translation hook
- `vitest.config.ts` — new file, test configuration
- `lib/__tests__/` — new directory, unit tests per domain
- `lib/actions/*.ts` — all 22 files rewritten (same functionality, new structure)
- `components/**/*.tsx` — ~30 components updated to use safe-action hooks
- `package.json` — new dependencies: `next-safe-action`, `vitest`, `@vitest/coverage-v8`
- `messages/en.json`, `messages/es.json` — error message keys may shift from `actions.*` namespace to a new `errors.*` namespace (or remain as-is with code mapping)
