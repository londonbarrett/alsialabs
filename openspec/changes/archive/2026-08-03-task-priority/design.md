## Context

Tasks live in the `project_task` table and already support a `status` enum (`todo | in_progress | in_review | blocked | done`) plus cost and assignee. There is no priority concept today. Tasks are displayed in the project "Tasks" table (`components/projects/project-tasks.tsx`), the project task form (`task-form.tsx`), and the "My Tasks" page (`components/my-tasks/*`). Status changes are handled owner-side via `updateTaskStatus`, and the UI follows shadcn patterns (Select, badge color maps, optimistic updates via `useReducer`).

This change adds an optional `urgent | high` priority to tasks. It is intentionally minimal: no "no priority" enum value, no reordering/sorting by priority, and no priority filters.

## Goals / Non-Goals

**Goals:**
- Add a nullable `priority` column to `project_task` accepting `urgent` or `high`.
- Show priority in the task form and in both task tables with distinct visual treatment.
- Let owners set/change priority from the project Tasks table.
- Internationalized labels (EN + ES).

**Non-Goals:**
- No `low` / `medium` levels (user chose urgent + high only).
- No sorting/grouping of tasks by priority.
- No priority filter on My Tasks.
- No priority-based notifications or Slack/Discord integration.
- No breaking changes to existing task behavior.

## Decisions

### 1. Data model: nullable text column with a `$type<>` union
Add `priority: text("priority").$type<"urgent" | "high" | null>()` (nullable, no default) to `projectTasksTable`, mirroring how `status` is typed.

- **Why:** Follows the existing enum-as-text convention in `lib/drizzle/schema.ts`; a Postgres `enum` type adds migration friction for two values and nullable default handling.
- **Alternative considered:** Postgres `pgEnum` — rejected for consistency with the existing `status`/project-status pattern.

### 2. Priority update endpoint mirrors `updateTaskStatus`
New server action `updateTaskPriority(taskId, projectId, priority: "urgent" | "high" | null)` in `lib/actions/project-tasks.ts`, owner-only (`projects:edit`), Zod-validated, calls `revalidatePath`.

- **Why:** Reuses the established permission + revalidation pattern; keeps priority mutation symmetric with status.
- **Alternative considered:** folding priority into `upsertTask` only — rejected because inline table editing (like status) needs a cheap dedicated action.

### 3. Form field optional, no validation changes
Add a nullable priority `Select` to `task-form.tsx` with options: no priority / Urgent / High. The Zod `taskSchema` gains `priority: z.enum(["urgent", "high"]).nullable().optional()`.

- **Why:** Matches the "no priority default" decision and keeps client-side validation unchanged (name-only).

### 4. Table presentation mirrors status
A compact priority column/badge in `project-tasks.tsx` and `my-tasks-list.tsx`, with an inline owner-only `Select` in the project table (like `TaskStatusSelect`). A shared `task-priority-select.tsx` exports `taskPriorityColors`:
- `urgent`: red-tinted badge
- `high`: orange-tinted badge

The select exposes optional `fullWidth` (form uses it) and `id` (forwarded to `SelectTrigger` so `FieldLabel htmlFor` links work) props. Both priority/status selects and all read-only table badges render via the shadcn `Badge` component.

- **Why:** Reuses the established status-select interaction and badge styling; a shared colors map keeps the two surfaces consistent; passing `id` through preserves accessible label wiring when composed inside shadcn `Field`.

### 5. Optimistic updates in the project table
Extend the existing `taskReducer` with an `updatePriority` action so inline priority changes are optimistic, mirroring `updateStatus`.

- **Why:** Consistency with the current UX pattern and avoids layout shift/refetch.

### 6. Forms use shadcn Field components
The task form was rebuilt with the shadcn `Field` family (`FieldGroup`/`Field`/`FieldLabel`/`FieldError`), using `data-invalid` on the field and `aria-invalid` on the control for validation. The previous custom `@/components/form-field` wrapper and raw `div`+`Label` select rows were removed.

- **Why:** Aligns form building with the project's shadcn conventions (AGENTS.md) and the [radix field](https://ui.shadcn.com/docs/components/radix/field) component.

### 7. Task dialog uses the shared dialog wrapper
`TaskDialog` now composes `@/components/common/dialog`. The shared wrapper gained an optional `onInteractOutside` prop so the dialog keeps its outside-click prevention behavior.

- **Why:** Avoids duplicating the dialog header/content pattern that `@/components/common/dialog` already provides.

### 8. Expenses view merges tasks and expenses by date
In `project-expenses.tsx`, task rows and expense rows are combined into one list sorted ascending by date, and task dates are formatted as `YYYY-MM-DD` to match the expense `date` column format.

- **Why:** Presents a unified chronological view of project spend instead of grouping by type; consistent date formatting avoids mixed date styles in one column.

## Risks / Trade-offs

- **Two-value scale is limiting** → If a third level is needed later, add a new enum value + label; the nullable column requires no backfill or migration of existing rows.
- **Nullable column vs "none" sentinel** → Nulls make the default invisible in schemas/forms; acceptable since "no priority" is the desired default state. Queries that need "has priority" filter on `is not null`.
- **Priority drift on task lists** → Priority is set once at creation and editable inline; no auto-clear on status change (out of scope).

## Migration Plan

1. Edit `lib/drizzle/schema.ts` to add the column.
2. Run `npx drizzle-kit generate` to create the migration (never hand-edit migration files).
3. Review the generated SQL, then `npx drizzle-kit migrate`.
4. No data backfill required (column is nullable).
5. Rename the generated file to a semantic name (`0015_add_task_priority.sql`) and update the matching entry in `drizzle/meta/_journal.json`. The migration is already applied in the DB and tracked by content hash, so the rename does not affect `drizzle-kit migrate` state; `npx drizzle-kit check` confirms consistency.

Rollback: drop the column via a new generated migration; the UI/action changes are reverted alongside.

## Open Questions

- None blocking. (Sorting/filtering by priority explicitly deferred to a future change.)
