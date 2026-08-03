## Why

Tasks currently have no notion of importance, so owners cannot surface which work needs attention first. Adding a priority field lets teams flag urgent work at a glance.

## What Changes

- Add an optional `priority` field to `project_task` with two levels: `urgent` and `high`.
- Tasks default to **no priority**; the field is nullable and not required when creating a task.
- Surface priority in the task form (create/edit), the project Tasks table, and the My Tasks table.
- Allow owners to change priority inline from the Tasks table.
- Add English and Spanish UI labels for the priority levels.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `project-management`: extend the Task management requirement so tasks can carry an optional `urgent` or `high` priority, displayed and editable in the task form and task tables.

## Impact

- **Schema**: `project_task.priority` (nullable text, values `urgent | high`) — `lib/drizzle/schema.ts`, migration `drizzle/0015_add_task_priority.sql`.
- **Server actions**: `lib/actions/project-tasks.ts` — extend `taskSchema` and `upsertTask`; add `updateTaskPriority` (owner-scoped, mirroring `updateTaskStatus`).
- **Shared UI**: new `components/projects/task-priority-select.tsx` (priority select + `taskPriorityColors`), updated `components/projects/task-status-select.tsx` (both accept `id`/`fullWidth`; badges via shadcn `Badge`).
- **Forms**: `components/projects/task-form.tsx` rebuilt with shadcn `Field` components; `components/projects/task-dialog.tsx` uses the shared `@/components/common/dialog` wrapper (which gained an `onInteractOutside` prop).
- **UI**: `components/projects/project-tasks.tsx` (priority column + inline owner select), `components/my-tasks/my-tasks-list.tsx` and `components/my-tasks/my-tasks-view.tsx` (priority badge column), `components/projects/expenses/project-expenses.tsx` (badges; rows ordered by date with consistent `YYYY-MM-DD` formatting).
- **i18n**: `messages/en.json`, `messages/es.json` — new `priority.*` keys.
- **Specs**: modify `openspec/specs/project-management/spec.md` Task management requirement.
