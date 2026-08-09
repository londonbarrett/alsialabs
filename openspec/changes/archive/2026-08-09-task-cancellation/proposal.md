## Why

Tasks have no way to represent work that was abandoned or is no longer needed — the only way to "get rid of" a task is to delete it (losing history) or mark it done (distorting progress). Owners need a `cancelled` status so tasks can be retired while staying visible in the task tables with their history, comments, and routine linkage intact.

## What Changes

- Add a `cancelled` status to the task status model (a TS-level extension of the `task.status` text column — no DB migration required)
- Allow owners to set a task to `cancelled` via the inline status dropdown; non-owners (collaborators and assignees) see cancelled tasks as read-only
- Cancelled tasks do not show the "Overdue" badge
- Cancelling a routine-instance task skips to the next occurrence (spawns the next instance, like `done`), and cancelled instances no longer count as "open" for routine spawning
- Project task progress excludes cancelled tasks from the total (progress = done / (total − cancelled))
- Add `cancelled` to the My Tasks status filter and to the status badge color map + i18n labels (EN/ES)

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-management`: The Task management and My Tasks page requirements gain a `cancelled` status with scenarios for owner cancellation, read-only visibility for non-owners, overdue exclusion, routine skip-to-next, and progress exclusion. The Routine management requirement's open-instance and spawn behavior is updated to treat cancelled instances as closed.

## Impact

- `lib/drizzle/schema.ts` — `tasksTable.status` type union gains `"cancelled"` (no column change)
- `lib/actions/tasks.ts` — `ownerStatusSchema` gains `cancelled`; non-owner guard blocks cancelled tasks; routine spawn triggers on `done` or `cancelled`; My Tasks status filter accepts `cancelled`
- `lib/actions/routines.ts` — open-instance check treats `cancelled` as closed
- `lib/actions/projects.ts` — task progress total excludes cancelled tasks
- `lib/utils.ts` — `isTaskOverdue` excludes `cancelled`
- `components/projects/tasks-card.tsx`, `components/my-tasks/my-tasks-view.tsx`, `components/my-tasks/my-tasks-list.tsx` — status arrays, read-only gating, filter
- `components/projects/task-status-select.tsx` — `cancelled` badge color
- `components/projects/task-form.tsx`, `components/projects/task-dialog.tsx`, `components/projects/expenses/project-expenses.tsx` — status type unions
- `messages/en.json`, `messages/es.json` — `projects.tasks.status.cancelled` labels
