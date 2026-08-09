## 1. Schema & migration

- [x] 1.1 Rename `tasksTable.scheduledFor` to `tasksTable.dueDate` (column `due_date`) in `lib/drizzle/schema.ts`
- [x] 1.2 Run `npx drizzle-kit generate` to create the rename migration and review the generated SQL
- [x] 1.3 Run `npx drizzle-kit migrate` to apply the rename

## 2. Server actions & shared utils

- [x] 2.1 Update `lib/actions/tasks.ts` — rename all `scheduledFor` references to `dueDate`, add `dueDate` to `taskSchema` as an optional nullable date string, and persist it in `upsertTask` create/update
- [x] 2.2 Update `lib/actions/routines.ts` — `createNextRoutineTask` writes `dueDate` instead of `scheduledFor`
- [x] 2.3 Export a `combineDateTime(date, time)` helper from `lib/routines/schedule.ts` that builds a local `Date` (midnight default when no time) from a `YYYY-MM-DD` date and optional `HH:MM` time
- [x] 2.4 Add a shared `isTaskOverdue(status, dueDate)` util used by both task tables

## 3. Task form & dialog

- [x] 3.1 Add "Due Date" date input and optional time input to `components/projects/task-form.tsx`, pre-filled from `task.dueDate`
- [x] 3.2 Include the combined `dueDate` value in the form submit payload and pass it through `components/projects/task-dialog.tsx`

## 4. Project Tasks table

- [x] 4.1 In `components/projects/tasks-card.tsx`, extend the optimistic task and `handleTaskSubmit` payload to carry `dueDate`
- [x] 4.2 Rename the column header to "Due Date" and render the date via the updated date component
- [x] 4.3 Show an "Overdue" badge with red date text for non-`done` tasks whose due date is in the past

## 5. My Tasks

- [x] 5.1 In `components/my-tasks/my-tasks-list.tsx`, rename the column header to "Due Date"
- [x] 5.2 Show the "Overdue" badge with red date text for non-`done` tasks whose due date is in the past

## 6. Date rendering component

- [x] 6.1 Rename/update `components/projects/scheduled-at.tsx` to render a due date with an optional overdue variant (red text + badge) driven by a flag

## 7. i18n

- [x] 7.1 In `messages/en.json`, rename `projects.tasks.scheduled` to `projects.tasks.dueDate` and add `projects.tasks.overdue`
- [x] 7.2 Mirror the same changes in `messages/es.json`

## 8. Verification

- [x] 8.1 Run the project's typecheck/lint commands and fix any errors
- [x] 8.2 Manually verify create/edit task with and without a due date, and overdue indicator behavior in both tables
