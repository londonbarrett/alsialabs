## Context

Tasks carry a `scheduledFor` timestamp column in `lib/drizzle/schema.ts` (column name `scheduled_for`) that is only ever written by routine spawning (`createNextRoutineTask` in `lib/actions/routines.ts`). The task form (`components/projects/task-form.tsx`) has no field for it, the Tasks table and My Tasks table label the column "Scheduled" and render it read-only via `components/projects/scheduled-at.tsx`, and nothing signals when a task's date has passed. Owners cannot set a due date on a manual task.

## Goals / Non-Goals

**Goals:**
- Rename the `scheduled_for` column to `due_date` (schema + Drizzle migration + all code references)
- Let owners set/clear an optional due date (date + optional time) when creating or editing a task
- Persist the due date through `upsertTask` and render it in the renamed column
- Show an "Overdue" badge (red) on tasks that are not `done` and whose due date is in the past, in both the project Tasks table and My Tasks
- Keep routine-instance tasks working: their computed schedule is simply surfaced as their due date and becomes editable

**Non-Goals:**
- Due-date-based sorting or a calendar/board view
- Overdue reminders, notifications, or due-date recurrence rules
- Server-side cron that flips task state on expiry

## Decisions

### D1. Rename the column `scheduled_for` → `due_date`

The column already stores exactly what a due date is, so renaming removes the misleading "scheduled" framing for both manual tasks and routine instances. The rename is done with a single Drizzle migration generated via `npx drizzle-kit generate` (per the Drizzle Migration Workflow in AGENTS.md). Drizzle's snapshot chain keeps `prevId → id` intact because the migration is generated, not hand-edited. The Drizzle column identifier becomes `dueDate` mapping to `due_date`. Routine semantics are preserved: a routine instance's computed occurrence *is* its due date.

### D2. Due date is a plain date input plus an optional time input

There is no date-picker component in the project; existing forms (`reminder-dialog.tsx`, `invoice-form.tsx`) use `<Input type="date">`. The task form follows that convention with a date field and an optional time field (`type="time"`). `dueDate` is a full timestamp, so the two inputs are combined client-side before submit.

### D3. Combine date + time with a small helper in the schedule lib

`lib/routines/schedule.ts` already has `parseISODate` (date-only, local timezone) and a private `applyTime`. A new exported helper, e.g. `combineDateTime(date, time)`, builds the local `Date`: `parseISODate(date)` with the time applied when provided, otherwise midnight. Both `task-form.tsx` (client) and the server `taskSchema` use it, keeping timezone handling consistent with routine scheduling. When only a date is entered, the due date is start-of-day local; without a date, the value is `null`.

### D4. Overdue is computed client-side at render time

A task is overdue when `status !== "done" && dueDate != null && new Date(dueDate) < new Date()`. Computed in the row-rendering components (`tasks-card.tsx`, `my-tasks-list.tsx`) because it must be fresh on every render and there is no server round-trip. A small shared `isTaskOverdue(status, dueDate)` util is used by both tables to avoid duplication.

### D5. `dueDate` flows through the optimistic-update pipeline

`TaskFormData` in `lib/actions/tasks.ts` gains `dueDate`, `upsertTask` writes it (create and update), and the form/dialog/optimistic payload types are extended. The optimistic task in `tasks-card.tsx` carries the chosen date so the row updates immediately. When the server response resolves, `replaceTemp` swaps in the canonical row.

### D6. i18n

`projects.tasks.scheduled` is renamed to `projects.tasks.dueDate`, and a new `projects.tasks.overdue` key ("Overdue") is added in both `messages/en.json` and `messages/es.json`. The header labels in both tables use `dueDate`; the badge uses `overdue`.

## Migration Plan

1. Edit `lib/drizzle/schema.ts`: rename the `tasksTable` field to `dueDate` mapping to column `due_date`
2. Run `npx drizzle-kit generate` to create the SQL + snapshot (never hand-edit)
3. Review the generated SQL for issues (rename only; no NOT NULL changes)
4. Run `npx drizzle-kit migrate` to apply
5. Update all code references from `scheduledFor`/`scheduled_for` to `dueDate`/`due_date` in a single pass

Rollback: revert the code rename and run `npx drizzle-kit generate` + `migrate` to rename the column back (the migration chain remains valid since both are generated migrations).

## Risks / Trade-offs

- **Date-only tasks and midnight semantics** → A task with only a date is due at start of day, so it shows overdue from the moment the date begins. This matches expectations for a day-level due date; if "due by end of day" is preferred later, D3 can default time to 23:59.
- **Client-side clock vs server clock** → The overdue check uses the viewer's local clock; a mismatch with server time could mislabel a task near the boundary. Acceptable for an admin dashboard; D4 keeps the check cheap and always current.
- **Column rename touches many files** → `scheduledFor` is referenced in actions, queries, and several components. Mitigation: the rename is mechanical (`scheduledFor` → `dueDate`, `scheduled_for` → `due_date`), verified by typecheck.
- **Editable due date on routine instances** → Editing a routine instance's due date only changes that one task; the routine schedule still computes the next occurrence. The next spawned instance may revert to the schedule's date. Documented behavior, not a regression.
