## 1. Database

- [x] 1.1 Add `priority` column to `projectTasksTable` in `lib/drizzle/schema.ts` as nullable `text("priority").$type<"urgent" | "high" | null>()` with no default
- [x] 1.2 Run `npx drizzle-kit generate` to create the migration and review the generated SQL
- [x] 1.3 Run `npx drizzle-kit migrate` to apply the migration
- [x] 1.4 Rename the generated migration to a semantic name (`0015_add_task_priority.sql`) and update the matching journal tag; `drizzle-kit check` passes

## 2. Server Actions

- [x] 2.1 Extend `taskSchema` in `lib/actions/project-tasks.ts` with `priority: z.enum(["urgent", "high"]).nullable().optional()` and add `priority` to `TaskFormData`
- [x] 2.2 Update `upsertTask` to read/write the `priority` field
- [x] 2.3 Add `updateTaskPriority(taskId, projectId, priority)` server action, owner-only + `projects:edit` permission, Zod-validated, with `revalidatePath`
- [x] 2.4 Verify `getProjectTasks` and `getMyTasks` return the `priority` field

## 3. Shared Priority UI

- [x] 3.1 Add a `taskPriorityColors` map (`urgent`: red, `high`: orange) in `components/projects/task-priority-select.tsx`
- [x] 3.2 Add i18n labels for priority (none/urgent/high) to `messages/en.json` and `messages/es.json`
- [x] 3.3 `TaskStatusSelect` and `TaskPrioritySelect` accept an optional `id` prop (forwarded to `SelectTrigger`) so `FieldLabel htmlFor` links work in the form
- [x] 3.4 All priority/status badges render via the shadcn `Badge` component (triggers, dropdown items, table cells) in `task-priority-select.tsx`, `task-status-select.tsx`, `my-tasks-list.tsx`, `my-tasks-view.tsx`, `project-tasks.tsx`

## 4. Task Form

- [x] 4.1 Add an optional priority `Select` (no priority / Urgent / High) to `components/projects/task-form.tsx`, defaulting to no priority
- [x] 4.2 Rebuild the form with shadcn `Field` components (`FieldGroup`/`Field`/`FieldLabel`/`FieldError`) using `data-invalid`/`aria-invalid` validation, replacing the custom `@/components/form-field` wrapper and raw `div`+`Label` rows
- [x] 4.3 Use `TaskStatusSelect`/`TaskPrioritySelect` (full-width) for status and priority, keeping the assignee select inline

## 5. Project Tasks Table

- [x] 5.1 Add a priority column with a badge to `components/projects/project-tasks.tsx` task table
- [x] 5.2 Extend `taskReducer` with an `updatePriority` action for optimistic updates
- [x] 5.3 Add an owner-only inline priority `Select` per row that calls `updateTaskPriority` with loading indicator + success toast
- [x] 5.4 Pass `priority` into the edit form pre-fill in `handleTaskSubmit`

## 6. My Tasks Table

- [x] 6.1 Add a priority column with a badge to `components/my-tasks/my-tasks-list.tsx`

## 7. Task Dialog & Expenses

- [x] 7.1 `TaskDialog` now uses the shared `@/components/common/dialog` wrapper (added an `onInteractOutside` prop to the common dialog to preserve outside-click prevention)
- [x] 7.2 In `components/projects/expenses/project-expenses.tsx`: expense rows use the shadcn `Badge` component, rows are merged into a single list ordered by date (not by type), and task dates render in the same `YYYY-MM-DD` format as expense dates

## 8. Verification

- [x] 8.1 Run `npx tsc --noEmit` (or the project's typecheck command) to confirm no type errors
- [x] 8.2 Run the project linter
- [x] 8.3 Run `npx drizzle-kit check` to confirm migration state is consistent
- [ ] 8.4 Manual smoke test: create task with no priority, create with urgent/high, edit priority, change priority inline, confirm badges render in both tables
