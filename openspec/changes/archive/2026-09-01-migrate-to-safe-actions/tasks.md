## 1. Foundation — Infrastructure

- [x] 1.1 Install dependencies: `npm install next-safe-action` and `npm install -D vitest @vitest/coverage-v8`
- [x] 1.2 Create `vitest.config.ts` with path alias support matching `tsconfig.json`
- [x] 1.3 Create `lib/actions/error-codes.ts` — `ActionError` constant object with all UPPERCASE codes matching existing `actions.*` translation keys (FORBIDDEN, UNAUTHORIZED, NOT_FOUND, VALIDATION_FAILED, PHONE_ALREADY_EXISTS, SKU_ALREADY_EXISTS, CLIENT_NOT_FOUND, EMAIL_ALREADY_EXISTS, etc.)
- [x] 1.4 Create `lib/safe-action.ts` — base `actionClient` with logging middleware, `basicAction` with permission + revalidation middleware, `storeAction` extending basic with `getEffectiveStoreId()`, `sessionAction` extending basic with `auth()`, `projectAction` extending session with `verifyProjectAccess()` via `useValidated`, `adminAction` with `auth()` + `isSuperUser()` bypassing permission system
- [x] 1.5 Create `lib/util/action-errors.ts` — `useActionError()` hook that returns a `(code: string) => string` translator using `useTranslations("errors")`
- [x] 1.6 Add `"test": "vitest"` and `"test:run": "vitest run"` scripts to `package.json`
- [x] 1.7 Create `lib/__tests__/safe-action.test.ts` — unit tests for middleware behavior: permission allows/rejects, store context provided, ownership check, admin check, revalidation called, updateTag called
- [x] 1.8 Create `lib/util/query-helpers.ts` — shared utilities to eliminate duplicated DB patterns:
  - `buildStoreCondition(table, storeId?)` — returns the dynamic `if (storeId) conditions.push(eq(table.store_id, storeId))` pattern used in 8+ files
  - `getRoleIdByName(name: string)` — cached lookup for `rolesTable` by name (replaces repeated `eq(rolesTable.name, "user")` queries in `users.tsx` and `clients.tsx`)

## 2. Error Codes & Translations

- [x] 2.1 Add `errors` namespace to `messages/en.json` with keys for all UPPERCASE codes: FORBIDDEN, UNAUTHORIZED, NOT_FOUND, VALIDATION_FAILED, and domain-specific codes (PHONE_ALREADY_EXISTS, SKU_ALREADY_EXISTS, CLIENT_NOT_FOUND, EMAIL_ALREADY_EXISTS, CANNOT_DELETE_WITH_REFERENCES, CANNOT_DELETE_SELF, CANNOT_DEMOTE_SELF, CANNOT_DELETE_LAST_SUPER, etc.)
- [x] 2.2 Mirror the same `errors` keys in `messages/es.json`
- [x] 2.3 Keep existing `actions.*` namespaces in both message files (will be removed after full migration)

## 3. Categories Domain (Proof of Concept)

### Server

- [x] 3.1 Create `lib/schemas/category.ts` — extract `categorySchema` from `lib/actions/categories.ts` into a standalone schema file; update Zod validation messages to use UPPERCASE error codes (e.g., `z.string().min(1, "NAME_REQUIRED")`)
- [x] 3.2 Rewrite `lib/actions/categories.ts` — split `upsertCategory` into `createCategory` (using `basicAction`, permission `categories:create`, returns created entity) and `updateCategory` (using `basicAction`, permission `categories:edit`, returns updated entity); add `deleteCategory` (using `basicAction`, permission `categories:delete`); replace `getActionT` with error codes; replace manual revalidation with metadata `revalidate: ["/dashboard/categories"]`; keep `getByTaxonomy` and `checkSlugExists` as query actions using `basicAction`

### Client

- [x] 3.3 Update `components/categories/category-form.tsx` — replace manual `useState("saving")` + try/catch with `useAction(createCategory)` or `useAction(updateCategory)` based on edit mode; replace `result.error` toast with `translate(result.serverError.code)`; handle `result.validationErrors` for field-level errors
- [x] 3.4 Update `components/categories/category-list-view.tsx` — if categories are passed as props from server component, switch to `useOptimisticAction` with optimistic add/remove; if fetched client-side, shift to server-component props pattern first, then apply `useOptimisticAction`

### Tests

- [x] 3.5 Create `lib/__tests__/categories.test.ts` — test `createCategory` (happy path, forbidden, slug uniqueness, validation), `updateCategory` (happy path, not found, slug conflict), `deleteCategory` (happy path, not found); mock DB via `vi.mock("@/lib/drizzle/client")`

## 4. Products Domain

### Server

- [x] 4.1 Create `lib/schemas/product.ts` — extract product schema with UPPERCASE error codes
- [x] 4.2 Rewrite `lib/actions/products.ts` — split `upsertProduct` into `createProduct` and `updateProduct` using `basicAction` (products are store-scoped); replace boilerplate with metadata; add `deleteProduct` with reference check
- [x] 4.3 **Optimization**: Use `ctx.storeId` from middleware for all store-scoped queries (replaces 5+ duplicated WHERE clause blocks)

### Client

- [x] 4.4 Update product form and list components to use `useAction`/`useOptimisticAction`

### Tests

- [x] 4.5 Create `lib/__tests__/products.test.ts` — test create, update, delete with store scoping, SKU uniqueness, reference check on delete

## 5. Expenses Domain

### Server

- [ ] 5.1 Create `lib/schemas/expense.ts` — extract expense schema with UPPERCASE error codes
- [ ] 5.2 Rewrite `lib/actions/expenses.ts` — split into `createExpense` and `updateExpense` using `basicAction`; add `deleteExpense`
- [ ] 5.3 **Optimization**: Use `buildStoreCondition()` for store-scoped queries

### Client

- [ ] 5.4 Update expense components to use safe-action hooks

### Tests

- [ ] 5.5 Create `lib/__tests__/expenses.test.ts`

## 6. Clients Domain

### Server

- [ ] 6.1 Create `lib/schemas/client.ts` — extract client schema with UPPERCASE error codes
- [ ] 6.2 Rewrite `lib/actions/clients.tsx` — split `upsertClient` into `createClient` and `updateClient` using `storeAction` (clients are store-scoped); replace boilerplate with metadata; keep `inviteClient`, `deleteClient`, phone uniqueness check
- [ ] 6.3 **Optimization**: Use `buildStoreCondition()` for all store-scoped queries (replaces 6+ duplicated WHERE clause blocks)
- [ ] 6.4 **Optimization**: Combine `checkPhoneExists` + client userId fetch into a single query (currently 2 sequential DB calls at lines 198 and 223-227)
- [ ] 6.5 **Optimization**: In `inviteClient`, use `Promise.all` for the client + role lookups (currently 4 sequential queries, first 2 are independent)

### Client

- [ ] 6.6 Update client form and list components — use `useAction` for mutations, `useOptimisticAction` for list operations

### Tests

- [ ] 6.7 Create `lib/__tests__/clients.test.ts` — test create, update, delete, invite, phone uniqueness

## 7. Projects Domain

### Server

- [ ] 7.1 Create `lib/schemas/project.ts` — extract project schema with UPPERCASE error codes
- [ ] 7.2 Rewrite `lib/actions/projects.ts` — split `upsertProject` into `createProject` and `updateProject` using `projectAction` (ownership via `verifyProjectAccess`); replace boilerplate with metadata; add `deleteProject`
- [ ] 7.3 **Optimization**: Eliminate "fetch-all-then-filter" pattern in `getProjects`/`getProjectsWithDetails` — push the `WHERE IN` clause into SQL instead of filtering in JS with `getUserProjectIds()`
- [ ] 7.4 **Optimization**: Remove duplicate `isProjectOwner` helper (lines 58-73) — reuse `verifyProjectAccess` from `project-access.ts` or fold owner check into the main query via JOIN
- [ ] 7.5 **Optimization**: Fix revalidation — `upsertProject` should revalidate both `/dashboard/projects` and `/dashboard/projects/${id}` for detail pages

### Client

- [ ] 7.6 Update project form and list components to use safe-action hooks

### Tests

- [ ] 7.7 Create `lib/__tests__/projects.test.ts` — test create, update, delete, ownership checks

## 8. Tasks Domain

### Server

- [ ] 8.1 Create `lib/schemas/task.ts` — extract task schema with UPPERCASE error codes
- [ ] 8.2 Rewrite `lib/actions/tasks.ts` — split `upsertTask` into `createTask` and `updateTask` using `projectAction`; replace `updateTaskStatus` and `updateTaskPriority` with metadata; add `deleteTask`
- [ ] 8.3 **Optimization**: Eliminate N+1 query for assignee name (lines 196-202) — use LEFT JOIN on the task insert/update returning result instead of a separate query

### Client

- [ ] 8.4 Update task components to use safe-action hooks

### Tests

- [ ] 8.5 Create `lib/__tests__/tasks.test.ts` — test create, update, delete, status/priority changes, project access checks

## 9. Users & Permissions Domain

### Server

- [ ] 9.1 Create `lib/schemas/user.ts` — extract user schema with UPPERCASE error codes
- [ ] 9.2 Rewrite `lib/actions/users.tsx` — split into `createUser`, `updateUser`, `deleteUser` using `adminAction`; replace boilerplate with metadata; keep dual revalidation (path + tag)
- [ ] 9.3 **Optimization**: In `updateUser`, reduce `rolesTable` lookups from 3 to 1 — pass role name through from the initial lookup instead of querying again
- [ ] 9.4 **Optimization**: In `deleteUser`, combine the 3 sequential queries (super role check, target role check, count query) into a single JOIN query
- [ ] 9.5 **Optimization**: Use `getRoleIdByName()` from `query-helpers.ts` instead of inline role lookups
- [ ] 9.6 Rewrite `lib/actions/permissions.ts` — `manageModule` and `togglePermission` using `adminAction` with dual revalidation metadata
- [ ] 9.7 **Optimization**: Batch `manageModule` permission inserts (lines 93-98) into a single `db.insert().values([...])` call instead of one-by-one in a loop

### Client

- [ ] 9.8 Update user and permission components to use safe-action hooks

### Tests

- [ ] 9.9 Create `lib/__tests__/users.test.ts` — test CRUD with admin-only access, self-demotion prevention, last-super deletion prevention
- [ ] 9.10 Create `lib/__tests__/permissions.test.ts` — test module management, permission toggle

## 10. Remaining Domains

### Sales

- [ ] 10.1 Create `lib/schemas/invoice.ts` and rewrite `lib/actions/sales.ts` using `projectAction` (ownership via `verifyProjectAccess`)
- [ ] 10.2 **Optimization**: Batch invoice line-item inserts (lines 227-244, 289-306) into a single `db.insert().values([...])` instead of one-by-one in a loop — this is the highest-impact N+1 fix
- [ ] 10.3 **Optimization**: Extract duplicated line-item computation loop (lines 228-243 and 289-305) into a shared `computeLineItems()` helper
- [ ] 10.4 **Optimization**: Wrap `requirePermission` in try/catch for `getMonthlyRevenue` and `getTopClientsByRevenue` (currently unhandled throws)
- [ ] 10.5 **Optimization**: Narrow revalidation — invoice mutations should revalidate `/dashboard/sales` for list changes and `/dashboard/sales/${invoiceId}` for detail changes
- [ ] 10.6 Update sales components
- [ ] 10.7 Create `lib/__tests__/sales.test.ts`

### Routines

- [ ] 10.8 Rewrite `lib/actions/routines.ts` using `projectAction`
- [ ] 10.9 Update routine components
- [ ] 10.10 Create `lib/__tests__/routines.test.ts`

### Calendar

- [ ] 10.11 Rewrite `lib/actions/calendar.ts` using `basicAction` (read-only queries)
- [ ] 10.12 Create `lib/__tests__/calendar.test.ts`

### Activities & Reminders

- [ ] 10.13 Create `lib/schemas/activity.ts` and `lib/schemas/reminder.ts`
- [ ] 10.14 Rewrite `lib/actions/activities.ts` and `lib/actions/reminders.ts` using `basicAction`
- [ ] 10.15 **Optimization**: Narrow revalidation — activities should revalidate `/dashboard/clients/${clientId}` + `/dashboard/activity` instead of broad `/dashboard/clients`; reminders should revalidate `/dashboard/clients/${clientId}` instead of broad `/dashboard/clients`
- [ ] 10.16 Update activity-timeline and reminder components (already use `useOptimistic` — swap to `useOptimisticAction`)
- [ ] 10.17 Create `lib/__tests__/activities.test.ts` and `lib/__tests__/reminders.test.ts`

### Remaining read-only and utility files

- [ ] 10.18 Rewrite `lib/actions/project-access.ts` — use `select({ exists: sql<boolean>\`true\` })` or minimal column selection instead of `select()` (all columns) for existence checks (hot path called from tasks, routines)
- [ ] 10.19 Rewrite `lib/actions/invoices.ts` — use minimal column selection for `getInvoiceItems` and `getInvoicePayments`
- [ ] 10.20 Rewrite remaining files (`client-timeline.ts`, `project-users.ts`, `stores.ts`) using appropriate action clients
- [ ] 10.21 Create unit tests for remaining domains

## 11. Database Indexes

- [ ] 11.1 Add indexes to `lib/drizzle/schema.ts` for high-traffic foreign keys:
  - `tasksTable`: index on `projectId`, `assigneeId`, `routineId`
  - `taskCommentsTable`: index on `taskId`
  - `invoiceItemsTable`: index on `invoiceId`
  - `invoicePaymentsTable`: index on `invoiceId`
  - `clientActivitiesTable`: index on `clientId`
  - `clientRemindersTable`: index on `clientId`
  - `expensesTable`: index on `projectId`
  - `invoicesTable`: index on `clientId`, `store_id`, `status`
  - `clientsTable`: index on `store_id`
  - `productsTable`: index on `store_id`
- [ ] 11.2 Run `npx drizzle-kit generate` to create migration, review generated SQL
- [ ] 11.3 Run `npx drizzle-kit migrate` to apply indexes

## 12. Cleanup

- [ ] 12.1 Remove `lib/hooks/use-server-action.ts` (replaced by `useAction` from next-safe-action)
- [ ] 12.2 Remove `getActionT` import from all converted action files
- [ ] 12.3 Remove old `actions.*` namespaces from `messages/en.json` and `messages/es.json` (replaced by `errors.*`)
- [ ] 12.4 Run typecheck and lint across entire codebase; fix any errors
- [ ] 12.5 Verify all unit tests pass: `npm run test:run`
