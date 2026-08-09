## 1. Schema & shared utils

- [x] 1.1 Add `"cancelled"` to the `tasksTable.status` type union in `lib/drizzle/schema.ts` (no DB migration — text column)
- [x] 1.2 Update `isTaskOverdue` in `lib/utils.ts` to return `false` for `status === "cancelled"`

## 2. Server actions

- [x] 2.1 In `lib/actions/tasks.ts`, add `"cancelled"` to `ownerStatusSchema` (leave `taskSchema` and `collaboratorStatusSchema` unchanged)
- [x] 2.2 In `updateTaskStatus`, block non-owners when `currentTask.status === "cancelled"` (mirror the existing `done` guard)
- [x] 2.3 In `updateTaskStatus`, spawn the next routine instance when the new status is `"done"` **or** `"cancelled"`, anchoring at `currentTask.dueDate`
- [x] 2.4 In `lib/actions/tasks.ts` `getMyTasks`, add `"cancelled"` to the valid status filter list
- [x] 2.5 In `lib/actions/routines.ts` `createNextRoutineTask`, treat `cancelled` instances as closed by changing the open-instance check from `ne(status, "done")` to `notInArray(status, ["done", "cancelled"])`
- [x] 2.6 In `lib/actions/projects.ts`, exclude cancelled tasks from the task progress total (`count(*) filter (where status <> 'cancelled')`)

## 3. Project Tasks table

- [x] 3.1 In `components/projects/tasks-card.tsx`, add `"cancelled"` to `allTaskStatuses` (leave `collaboratorTaskStatuses` unchanged)
- [x] 3.2 In `tasks-card.tsx` `getTaskAllowedStatuses`, return `null` (read-only) when `task.status === "cancelled"` for non-owners
- [x] 3.3 Extend the optimistic task status unions in `tasks-card.tsx` and `components/projects/expenses/project-expenses.tsx` (and the `task-dialog.tsx` onSubmit type) to include `"cancelled"`

## 4. My Tasks

- [x] 4.1 In `components/my-tasks/my-tasks-view.tsx`, add `"cancelled"` to `allTaskStatuses` (drives the filter dropdown and owner status options; leave `collaboratorTaskStatuses` unchanged)
- [x] 4.2 In `my-tasks-view.tsx` `getTaskAllowedStatuses`, return `null` (read-only) when `task.status === "cancelled"` for non-owners

## 5. Status rendering & i18n

- [x] 5.1 Add a `cancelled` entry to `taskStatusColors` in `components/projects/task-status-select.tsx` using a neutral slate style
- [x] 5.2 Add `projects.tasks.status.cancelled` ("Cancelled") to `messages/en.json`
- [x] 5.3 Add `projects.tasks.status.cancelled` ("Cancelado") to `messages/es.json`

## 6. Verification

- [x] 6.1 Run typecheck (`npx tsc --noEmit`) and lint on changed files; fix any errors
- [x] 6.2 Manually verify owner can cancel/reopen a task, cancelled tasks are read-only for non-owners, no overdue badge on cancelled, routine skip-to-next on cancel, My Tasks "Cancelled" filter, and progress exclusion on the project card
