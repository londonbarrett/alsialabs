## Why

Tasks already store a `scheduled_for` timestamp, but it is only populated by routines and is not editable. Owners have no way to set a due date on a manual task, and nothing in the UI flags tasks whose date has passed, so important work can silently slip. The field is also misleadingly named "scheduled" when what it represents is a task's due date.

## What Changes

- The `scheduled_for` column is renamed to `due_date` (Drizzle schema + generated migration), and every code reference (`scheduledFor`, `scheduled_for`, "Scheduled") is updated
- The task dialog gains a "Due Date" section (date + optional time) so owners can set or edit a task's due date when creating or editing a task
- The "Scheduled" column header is renamed to "Due Date" on both the project Tasks table and the My Tasks table
- Overdue indicators: any task that is not `done` and whose due date is in the past shows a red "Overdue" badge (and red date text) in the Due Date column of both tables
- `upsertTask` accepts and persists a `dueDate` datetime; manual tasks and routine-instance tasks share the same field and rendering
- Routine-instance tasks keep their computed due date, which is now also editable via the task dialog

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-management`: The Task management requirement gains due-date editing and overdue-indicator scenarios; the My Tasks page requirement gains an overdue-indicator scenario and updates the "Scheduled" column references to "Due Date"

## Impact

- `lib/drizzle/schema.ts` — `tasksTable.scheduledFor` → `tasksTable.dueDate` (column `due_date`)
- `drizzle/` — new generated migration renaming `scheduled_for` → `due_date`
- `lib/actions/tasks.ts` — `taskSchema` gains `dueDate`; `upsertTask` sets it on create/update
- `lib/actions/routines.ts` — routine spawning writes `dueDate`
- `components/projects/task-form.tsx` — new due date + time inputs
- `components/projects/task-dialog.tsx` — passes `dueDate` through the submit payload
- `components/projects/tasks-card.tsx` — "Due Date" column header, overdue badge, optimistic update payload
- `components/my-tasks/my-tasks-list.tsx` — "Due Date" column header, overdue badge
- `components/my-tasks/my-tasks-view.tsx` — status-change filter logic adjusted so completing a task doesn't spuriously re-add overdue instances
- `components/projects/scheduled-at.tsx` — renamed date rendering with optional overdue styling/flag
- `messages/en.json`, `messages/es.json` — rename `scheduled` key, add `dueDate`, `overdue`, `dueDateChanged` keys
