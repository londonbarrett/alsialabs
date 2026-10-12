## 1. Infrastructure

- [x] 1.1 In `lib/safe-action.ts`, make `handleServerError` detect `ActionOutputDataValidationError` and log it as an output-validation mismatch while still returning `{ code: "FORBIDDEN" }`; verify with a new case in `actions/__tests__/safe-action.test.ts` and `npx vitest run actions/__tests__/safe-action.test.ts`
- [x] 1.2 Add a representative `.outputSchema(...)` to one small safe action (e.g. `deleteProject` returning `{ success: true }`) and confirm `result.data` narrows without a cast; verify `npx tsc --noEmit`

## 2. Shared response schemas

- [x] 2.1 Define the shared cross-cutting output schemas in `actions/schemas/*`: invoice-with-client row, task-with-comment-count row, store option, user-with-role/user option, permission-matrix item, project summary/detail, calendar task/routine data, timeline entry, reminder row; verify each composes (`.extend`/`.pick`/`.omit`) rather than duplicating and `npx tsc --noEmit` passes
- [x] 2.2 Audit shared schemas against Drizzle inferred types (`z.date()` for timestamps, `z.string()` for numeric/date columns, `z.number()` for `count`, `z.string()` for `sum`) so no runtime transform rewrites data; verify with `npx tsc --noEmit`

## 3. Categories and Products

- [x] 3.1 Categories: co-locate response schemas in `actions/schemas/category.ts`, attach `.outputSchema(...)` to every action in `actions/categories.ts`, update consumers in `components/categories/*`, delete any mirror types; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/categories.test.ts`
- [x] 3.2 Products: co-locate response schemas in `actions/schemas/product.ts`, attach `.outputSchema(...)` to `actions/products.ts`, update `components/products/*` and `stores/*`, delete `ProductWithStoreDTO` mirror if redundant; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/products.test.ts`

## 4. Expenses, Payments, Sales

- [x] 4.1 Expenses: co-locate response schemas in `actions/schemas/expense.ts`, attach `.outputSchema(...)` to `actions/expenses.ts`, update `stores/expenses/*` and expense components, delete `ExpenseWithCategoryDTO` if redundant; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/expenses.test.ts`
- [x] 4.2 Payments: co-locate response schemas in `actions/schemas/payment.ts`, attach `.outputSchema(...)` to `actions/payments.ts`, update `stores/invoice/*` payment handlers and remove casts; verify `npx tsc --noEmit` and `npx vitest run actions/payments.test.ts`
- [x] 4.3 Sales: co-locate response schemas for `getMonthlyRevenue`/`getTopClientsByRevenue`, attach `.outputSchema(...)` to `actions/sales.ts`, update sales components; verify `npx tsc --noEmit` and `npx eslint components/sales actions/sales.ts`

## 5. Clients and Users

- [x] 5.1 Clients: co-locate response schemas in `actions/schemas/client.ts`, attach `.outputSchema(...)` to `actions/clients.tsx`, replace the hand-written `ClientOptionDTO` with the inferred type, update client components; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/clients.test.ts`
- [x] 5.2 Users: co-locate response schemas in `actions/schemas/user.ts`, attach `.outputSchema(...)` to `actions/users.tsx`, replace `UserWithRoleDTO`/`UserOptionDTO` mirrors, update `components/users/*`; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/users.test.ts`

## 6. Projects and Project People

- [x] 6.1 Projects: co-locate response schemas in `actions/schemas/project.ts`, attach `.outputSchema(...)` to `actions/projects.ts`, replace `ProjectWithCategory`, `ProjectDetailDTO`, `ProjectOwnerDTO`, `ProjectCategoryOption`, `ProjectContextDTO` with inferred types, update `stores/projects/*` and project components; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/projects.test.ts`
- [x] 6.2 Project people: co-locate response schemas, attach `.outputSchema(...)` to `actions/project-people.ts`, replace `ProjectMemberDTO` mirror if redundant, update `stores/project-context/*` and project detail components; verify `npx tsc --noEmit`

## 7. Tasks and Comments

- [x] 7.1 Tasks: co-locate response schemas in `actions/schemas/task.ts`, attach `.outputSchema(...)` to `actions/tasks.ts`, replace `MyTaskDTO` and the `StatusResultData` cast in `stores/my-tasks/use-my-tasks-actions.ts` and `stores/project-tasks/*`, update task components; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/tasks.test.ts`
- [x] 7.2 Task comments: co-locate response schemas in `actions/schemas/task-comment.ts`, attach `.outputSchema(...)` to `actions/task-comments.ts`, replace `TaskCommentWithAuthorDTO` mirror with inferred type, update `stores/project-tasks/*`; verify `npx tsc --noEmit`

## 8. Routines and Invoices

- [x] 8.1 Routines: co-locate response schemas in `actions/schemas/routine.ts`, attach `.outputSchema(...)` to `actions/routines.ts`, replace `RoutineWithAssigneeDTO` if redundant, update `stores/routines/*`; verify `npx tsc --noEmit` and `npx vitest run actions/__tests__/routines.test.ts`
- [x] 8.2 Invoices: co-locate response schemas in `actions/schemas/invoice.ts`, attach `.outputSchema(...)` to all `actions/invoices.ts` queries/mutations, replace `ClientInvoice`/`InvoiceWithClient`/`MyInvoice`/`MyInvoicesResult`/`InvoiceProductOption`, remove `as` casts in `stores/invoice/use-invoice-actions.ts`, consolidate `InvoiceWithClientName` in `components/sales/sales-invoice-table.tsx`; verify `npx tsc --noEmit` and `npx vitest run actions/invoices.test.ts`

## 9. Not-safe modules

- [x] 9.1 Stores and project access: co-locate response schemas, annotate `actions/not-safe/stores.ts` and `actions/not-safe/project-access.ts` returns with inferred types, replace `StoreOptionDTO`/`UserStore` mirrors, update `components/store-switcher.tsx`, `components/products/product-list-view.tsx`, `app/app/layout.tsx`; verify `npx tsc --noEmit`
- [x] 9.2 Activities, activity, client-timeline: co-locate response schemas, annotate `actions/not-safe/activities.ts`, `activity.ts`, `client-timeline.ts`, replace `ActivityFormDTO`, `UpsertActivityResultDTO`, `ClientTimelineEntryDTO` mirrors, update `stores/activity/*` and `stores/timeline/*`; verify `npx tsc --noEmit` and `npx vitest run stores/activity/activity-store.test.ts`
- [x] 9.3 Reminders: co-locate response schemas, annotate `actions/not-safe/reminders.ts`, replace the `ReminderRecordDTO` mirror and `ReminderSubmitData` if redundant, update reminder components; verify `npx tsc --noEmit`
- [x] 9.4 Calendar: co-locate `CalendarTaskDataDTO`/`CalendarRoutineDataDTO` output schemas, annotate `actions/not-safe/calendar.ts`, update `components/calendar/*` and `lib/calendar/*`; verify `npx tsc --noEmit`
- [x] 9.5 Permissions: co-locate response schemas, annotate `actions/not-safe/permissions.ts`, replace `PermissionMatrixItemDTO` mirror, update `components/permission-matrix.tsx` and `app/app/permisos/page.tsx`; verify `npx tsc --noEmit`
- [x] 9.6 Import clients: co-locate response schemas, annotate `actions/not-safe/import-clients.ts` return, update `components/import-button.tsx`; verify `npx tsc --noEmit`

## 10. Cleanup and verification

- [x] 10.1 Shrink `lib/types.ts` to client-only types and schema-inferred re-exports; delete any type now unused; verify `npx tsc --noEmit`
- [x] 10.2 Remove remaining `Awaited<ReturnType<typeof ...>>` derivations, hand-written action mirrors, and `result.data` casts repo-wide; verify no matches remain for the cast/derivation patterns and `npx tsc --noEmit` passes
- [x] 10.3 Delete `lib/util/unwrap.ts` if fully unused (or keep and document) and update any remaining importers; verify `npx tsc --noEmit`
- [x] 10.4 Run full `npx tsc --noEmit`, `npx eslint actions components app stores lib hooks`, and `npx vitest run`; verify all pass
- [x] 10.5 Run `npx openspec validate type-action-responses --strict` and `npx openspec validate --specs`; verify both pass
