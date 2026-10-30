# Project roles, merged repeating tasks, and assignments — Design

## Why this exists

Three problems in the current model push in the same direction.

A project's people are described by two tables, `project_owner` and `project_collaborator`, which can only say "owner" or "not owner". There is no way to give someone responsibility over a project's _work_ without also giving them power over the _project_, so the person coordinating day-to-day work ends up able to delete the project.

A task carries exactly one assignee and one status. Work that several people share therefore has to be duplicated into several tasks, fragmenting the evidence, the due date, and the conversation. And because the status belongs to the task rather than to a person, one person's progress stands in for everyone's.

Recurring work lives in a second table, `routine`, whose columns are otherwise identical to `task`: same name, description, cost, project, and assignee. It exists only to carry schedule fields, and it spawns copies of itself as tasks. That is a second work-item model for no conceptual gain.

The change unifies all three: project membership becomes one table with explicit roles, `task` absorbs the schedule fields and becomes the single source of truth for work, and per-person progress moves into **assignments** — one row per person doing a task, each with its own status, note, start, and due date. Routines disappear as a concept: a task is simply repeatable or it is not.

Naming matters. The row is an **assignment** (`task_assignment`), not a subtask: it has no title, no children, and no hierarchy. A task is not a template either — it is the work itself, and it repeats in place.

## Scope of this change

This design covers the full target architecture. Two phases ship from it:

**Phase 1 (this session).**

- `project_membership` roles and the owner / admin / collaborator permission split.
- `task` absorbs the schedule fields; `routine` is dropped and its UI removed.
- `task_assignment` replaces `task.assignee_id` and `task.status`, and carries its own start and due datetimes.
- Repeating tasks: completing an assignment schedules the next occurrence for that person.
- My Tasks splits into active and past assignments.
- The task cost field and every aggregation built on it are removed. A new cost model is a later session; nothing assumes costs exist in between.

**Phase 2 (postponed).**

- Assigning a task to several people at once, with the avatar stack, done-progress summary, and expandable per-assignment rows.

Phase 1 stores and returns assignments as a list everywhere, and every server action accepts `assigneeIds`, so Phase 2 is a UI change plus the picker — not a schema change. Phase 1's form submits at most one id.

## Goals

- One `project_membership(project_id, user_id, role)` table holding `admin` and `collaborator`. Exactly one owner per project, stored on `project.primary_owner_id` and never in the membership table.
- An admin manages the project's work (tasks and expenses) and manages collaborators. An admin cannot add, remove, or demote admins, cannot edit project details, and cannot delete the project.
- Every authenticated user can open the projects section. The list shows only projects where the caller is owner or admin, and the project route admits only those. A project where someone is merely a collaborator is invisible to them.
- Super users have no special access to projects: no override in the list, the route, My Tasks, or the calendar. They see a project only through a real role.
- `task` holds name, description, priority, and optional recurrence. A null recurrence means the task does not repeat.
- A non-repeating task is a bounded window with `startDate` and `endDate` (full datetimes). A repeating task has `startTime` and `endTime` (times of day); each occurrence runs from its date at `startTime` to the same date at `endTime`.
- `task_assignment(task_id, user_id, status, comment, start_date, end_date)` carries per-person progress. Assignments are created for every assignee at task creation, and one more each time a repeating occurrence completes. Its two datetimes are the snapshotted occurrence window.
- Non-repeating tasks copy their window onto each assignment at creation. A repeating task's assignment gets the computed occurrence datetime.
- Assignments are snapshots. Editing a task never rewrites an existing assignment; schedule and date changes take effect only on assignments created afterwards.
- A repeating task repeats in place: the task row stays, and each occurrence is an assignment row. History therefore lives in assignments.
- My Tasks lists the caller's active assignments and their past (closed) assignments separately.
- Collaborators may change only their own assignment, only to `in_progress`, `blocked`, or `in_review`, and not once it is `done` or `cancelled`.
- A removed collaborator keeps read-only access to the assignments they had; nothing else in the project.

## Non-goals

- Notifications. None exist and none are added.
- Real subtasks: child work items with their own title, description, or nesting.
- Assignment comment threads. An assignment note is a single text field.
- Materialized views, RLS, or authorization enforced by a view.
- Merging global app roles (`role`, `user_role`) with project roles.
- Preserving existing task, routine, `project_owner`, or `project_collaborator` data.
- Any replacement cost model. Costs are removed and return in a later session.

## Anti-goals

- A `routine` table, a `routine_id` on tasks, or template/occurrence parent links. There is exactly one work-item table and it is `task`.
- A task-level status, a "primary assignee", or a stored parent status.
- Repeating a task by cloning the task row. The task row is stable; assignments repeat.
- Repeating the owner/admin/collaborator test inline in each action. One resolver answers "what role does this caller hold on this project."
- Backfilling or preserving disposable data during the migration.
- A view that becomes the write model.

## Data model

### `task` (merged)

Keeps `id`, `project_id`, `name`, `description`, `priority`, `created_at`, `updated_at`. Drops `cost`, `status`, `assignee_id`, `routine_id`, and the legacy `due_date`.

Work window — meaningful for a **non-repeating** task:

| column     | type                  | notes                                        |
| ---------- | --------------------- | -------------------------------------------- |
| `start_date` | timestamptz, nullable | when the work starts (full datetime) |
| `end_date` | timestamptz, nullable | when the work ends (full datetime) |

Recurrence — meaningful for a **repeating** task:

| column         | type           | notes                                                  |
| -------------- | -------------- | ------------------------------------------------------ |
| `recurrence`   | text, nullable | `'daily'` \| `'weekly'`; null means it does not repeat |
| `interval`     | integer        | default 1 and unused when not repeating                |
| `days_of_week` | text[]         | nullable                                               |
| `start_time`   | time, nullable (string) | the occurrence's start time of day |
| `end_time`     | time, nullable (string) | the occurrence's end time of day   |

The two sets are mutually exclusive by convention: a task with `recurrence` set has its window columns empty, and vice versa. A "Repeat this task" switch in the UI writes `recurrence`; there is no separate boolean.

A non-repeating task's window never spans midnight: `startDate` and `endDate` must fall on the same calendar day, and `endDate` must not precede `startDate`. The form and the Zod schema both enforce it, so an assignment — a copy of the window — is likewise single-day.

### `task_assignment` (new)

| column       | type                  | notes                                            |
| ------------ | --------------------- | ------------------------------------------------ |
| `id`         | text                  | primary key, `crypto.randomUUID()`               |
| `task_id`    | text                  | FK → `task.id`, `on delete cascade`              |
| `user_id`    | text                  | FK → `user.id`, `on delete cascade`              |
| `status`     | text                  | default `'todo'`, `$type<TaskStatus>()`          |
| `comment`    | text                  | nullable — the assignee's note                   |
| `start_date` | timestamptz, nullable | copied from the task, or the occurrence datetime |
| `end_date`   | timestamptz, nullable | copied from the task, or the occurrence datetime |
| `created_at` | timestamptz           | default now                                      |
| `updated_at` | timestamptz           | default now, `$onUpdate`                         |

Assignment values are written once, at creation, and never rewritten by task edits. A repeating task's completed occurrence keeps its row; the next occurrence is a new row, so `(task_id, user_id)` is unique only while an occurrence is open — a **partial unique index** on `(task_id, user_id) where status not in ('done','cancelled')`. Index on `user_id` for My Tasks and the calendar.

Assignment creation values:

- **Non-repeating task:** `start_date` and `end_date` are copies of the task's `startDate` and `endDate`.
- **Repeating task:** the first occurrence date is computed from the task's schedule, anchored at now; the assignment's `start_date` is that date at `startTime` and its `end_date` is that date at `endTime`.

### `project_membership` (new)

| column       | type        | notes                                  |
| ------------ | ----------- | -------------------------------------- |
| `project_id` | text        | FK → `project.id`, `on delete cascade` |
| `user_id`    | text        | FK → `user.id`, `on delete cascade`    |
| `role`       | text        | `'admin'` \| `'collaborator'`          |
| `created_at` | timestamptz | default now                            |

Primary key `(project_id, user_id)`, check constraint on `role`. The owner never appears here.

### Migration

Task, routine, and membership data are all declared disposable. The migration:

1. Truncates `task` (cascading to `task_comment`) and drops `routine`.
2. Drops `project_owner` and `project_collaborator` with their rows — no backfill. Every project keeps its `primary_owner_id` and comes out with an owner, no admins, and no collaborators.
3. Creates `project_membership`, `task_assignment`, and the `task_assignment_detail` view.

Schema DDL is generated with `pnpm db:generate`; the truncate is added with `pnpm db:generate --custom`, the sanctioned path for data statements. Generated DDL is never hand-edited. The e2e seed (`lib/drizzle/seed-e2e.ts`) is rewritten to create tasks with assignments and membership rows, and to stop creating routines.

## Repeating tasks

A repeating task's open assignment carries the occurrence datetime. When that assignment reaches `done` or `cancelled`:

1. Compute the next occurrence date from the assignment's `end_date` using `computeScheduledFor` and the task's schedule (`startTime` supplies the time of day).
2. Insert a new assignment for the same user, status `todo`, with `start_date` = that date at `startTime`, `end_date` = that date at `endTime`, and an empty comment.
3. Repeat until the task's recurrence is turned off or the task is deleted; there is no global end date.

The old row is retained as history. This is per-person: with several assignees each person's chain advances on their own completion, which is why the dates live on the assignment.

For a non-repeating task, completing an assignment spawns nothing.

The cascade runs server-side in `updateAssignmentStatus`, inside the same transaction as the status write, and returns the new assignment so the client can insert it optimistically.

## Permissions

`verifyProjectAccess` returns a role instead of a boolean:

```ts
type ProjectRole = "owner" | "admin" | "collaborator"
type ProjectAccess = { hasAccess: boolean; role: ProjectRole | null }
```

There is no superuser override. Super users hold project access only through an actual row.

`projectAction` and `projectScopedAction` inject `ctx.projectRole`. Capability helpers live in one module and are derived from it:

| capability                                      | owner | admin | collaborator                            |
| ----------------------------------------------- | ----- | ----- | --------------------------------------- |
| open the projects section                       | yes   | yes   | yes                                     |
| see the project in the list                     | yes   | yes   | **no**                                  |
| open the project route                          | yes   | yes   | **no**                                  |
| edit project details, delete or archive project | yes   | no    | no                                      |
| add / remove / demote admins                    | yes   | no    | no                                      |
| add / remove collaborators                      | yes   | yes   | no                                      |
| create / edit / delete tasks                    | yes   | yes   | no                                      |
| create / edit / delete expenses                 | yes   | yes   | no                                      |
| change any assignment's status and note         | yes   | yes   | no                                      |
| change own assignment's status                  | yes   | yes   | yes, limited                            |
| read the task's comments                        | yes   | yes   | only where they hold an open assignment |
| write a task comment                            | yes   | yes   | only where they hold an open assignment |

Status rules:

- Owners and admins may set any `TASK_STATUSES` value on any assignment at any time.
- Collaborators may set only `in_progress`, `blocked`, `in_review` on their own assignment, and only while it is open. Once an assignment is `done` or `cancelled`, a collaborator cannot change it.
- Only owners and admins can set `done` or `cancelled`.

**Global permissions no longer apply inside projects.** Project-scoped actions authorize solely by project role. The seeded global `projects:*` and `expenses:*` permissions stop gating in-project actions. This removes a live inconsistency where task mutations required the global `projects:edit` (`actions/tasks.ts:191`) while the seeded global `admin` role holds only `projects:view` (`lib/drizzle/seed.ts:104`).

## Server actions

- `getTasks` returns each task with an `assignments` array (id, user id, name, email, image, status, comment, start, due date). Assignments are loaded with a second query keyed by task ids and grouped in memory, never joined in a way that multiplies task rows.
- `createTask` accepts `assigneeIds: string[]` (Phase 1's form sends zero or one), the work window, and the recurrence fields. It inserts the task and one assignment per assignee in a transaction, applying the creation values above.
- `updateTask` accepts `assigneeIds` and diffs the assignment set: open rows for new users are inserted, open rows for removed users are deleted. It never rewrites an existing assignment's dates, status, or note.
- `updateAssignmentStatus(assignmentId, status)` replaces `updateTaskStatus`. It enforces the permission matrix, then runs the repeat cascade.
- `updateAssignmentComment(assignmentId, comment)` follows the same permission rule; empty string stores null.
- `getMyTasks` returns the caller's assignments joined to their tasks, split by status: active (`todo`, `in_progress`, `in_review`, `blocked`) and past (`done`, `cancelled`). A removed collaborator sees only the past set.
- `getTaskContext` for comments resolves "does the caller hold an open assignment on this task" instead of `assigneeId === userId`.
- `getProjects` / `getProjectsWithDetails` filter to projects where the caller is owner or admin, with no superuser branch.
- Assignee validation: every id must be the project's owner or a member of `project_membership`. Unknown, cross-project, and superuser ids are rejected.

Removed from the codebase: `actions/routines.ts`, `actions/schemas/routine.ts`, `lib/routines/*`, `stores/routines/*`, `components/projects/routines/*`, the routine branches of the calendar, and the routine translation keys that no longer apply. Their useful pieces — `computeScheduledFor` and `lib/util/schedule.ts` — move under the task feature. Deleting these files will be confirmed before implementation.

## The view

`task_assignment_detail`, declared in `lib/drizzle/schema.ts` via `pgView(...).as(qb => ...)` so `pnpm db:generate` emits it. Read-only; never used for authorization.

Columns: assignment `id`, `task_id`, `user_id`, `status`, `comment`, `start_date`, `end_date`; task `name`, `priority`, `recurrence`, `project_id`; user `name`, `email`, `image`. Both task and user have a `name`, so every column is aliased (`task_name`, `user_name`, `user_email`, `user_image`).

Consumers: the project task list, My Tasks, and the calendar — the three places that repeat the assignment → task → user join. The cost of adopting a view is that changing it later is drop-and-create in a migration rather than `ALTER`; acceptable for a read shape.

## UI

### Task form — two-step wizard

Reuses the interaction of `components/projects/routines/routine-form.tsx` and its `StepIndicator`, which are removed with the routines surface; the wizard ships in the task feature.

- **Step 1 — details:** name (required), description, priority, assignee (single select for Phase 1), start datetime, and end datetime. No status field: a new assignment starts at `todo`.
- **Step 2 — repeat:** a "Repeat this task" switch. Off writes `recurrence = null` and keeps step 1's window. On reveals recurrence (daily / weekly), interval, weekdays, and start and end times; the step-1 window is then ignored.

The dialog contract replaces `status` and `assigneeId` with `assigneeIds: string[]`, `startDate`, `endDate`, `recurrence`, and the recurrence fields (`startTime`, `endTime` included).

### Project task list

One row per task: name, priority, next date, assignee name, status control, and a **routine badge** on repeating tasks. With Phase 1's single assignment the status control reads and writes that assignment; the DTO already carries `assignments[]`, so Phase 2's expansion is additive.

A repeating task shows the date of its earliest open assignment. Overdue styling compares the caller's own assignment due date where one exists, otherwise the task's.

### My Tasks

Two sections:

- **Active** — the caller's open assignments: task title, project, start, due date, priority, and their own status control.
- **Past** — closed assignments, read-only: task title, project, the occurrence's dates, final status, and the note.

A removed collaborator sees only Past.

### Calendar

The calendar is assignment-driven: it reads `task_assignment_detail`, so each assignment sits on its own date. Collaborators see only their own assignments; owners and admins see the project's. When more than one assignment of the same task falls on the same day — always the case for a non-repeating task, since its assignments share the task's window — the client groups those into a single event listing the assignees. Grouping never spans days: per-person dates mean two assignees can legitimately be on different dates.

Super users have no project events and no assignments of their own unless they hold a real role.

### Costs

`task.cost` and every aggregation built on it are removed. Concretely: the project's spent total no longer includes task costs (`actions/projects.ts:210,340`), the expenses screen stops listing and summing task costs (`components/projects/expenses/project-expenses.tsx:163-190`), and the calendar event meta drops its cost entry. No placeholder remains.

### Projects section

Every role can open the projects section. The list is filtered to projects where the caller is owner or admin, so a user who only collaborates sees an empty list rather than a hidden section. The project route applies the same rule and rejects anyone who is not its owner or admin. Navigation keeps the projects entry for everyone.

## Stores

- `stores/project-tasks/`: tasks carry `assignments`. Mutations become `createTask(assigneeIds, window, schedule)`, `updateTask`, `updateAssignmentStatus` (which also inserts the spawned next occurrence), `updateAssignmentComment`. Temp rows carry their assignments so the optimistic row is complete; the commit action swaps the whole row for the server's.
- `stores/my-tasks/`: `MyTask` is an assignment, split into active and past. Status updates key by assignment id.
- `stores/project-context/`: `members` comes from the owner plus `project_membership`, carrying `role`; `isOwner` gives way to `role` and derived capability booleans.
- All mutations keep going through `useOptimisticAction` / `useSettle`.

## i18n

`messages/en.json` and `es.json` stay structurally identical.

- Add `projects.tasks.recurring` (the routine badge), `projects.tasks.assignments`, `projects.tasks.assignmentNote`, and My Tasks' `active` / `past` section labels.
- Reuse `common.assignee`, `common.unassigned`, `common.status`, `projects.tasks.status.*`.
- Remove routine-only keys that no longer have a surface; keep schedule labels the repeat step reuses.
- Project role labels get their own `projects.roles.*` namespace rather than overloading app-role labels.

## Testing

Unit (vitest, beside the action/store):

- Access resolver: owner, admin, collaborator, superuser, stranger. Superuser gets no implicit access.
- Membership management: admin may add/remove collaborators, may not add/remove/demote admins; owner may do all.
- `getProjects`: a collaborator sees only projects they own or administer; a superuser sees none without a role.
- `createTask`: one assignment per assignee id, validated against project membership; a non-repeating task copies its window onto the assignment; a repeating task's first assignment gets the computed occurrence datetime; a window crossing midnight is rejected.
- `updateTask`: assignment diffing; existing assignments keep their dates, status, and note after a task edit.
- `updateAssignmentStatus`: own-open-assignment rules for collaborators; terminal lock; owner/admin unrestricted; repeat cascade computes the next datetime and inserts exactly one new row; no spawn for non-repeating tasks.
- `updateAssignmentComment`: permission matrix, trim, empty → null.
- `getMyTasks`: active/past split; removed collaborator sees past only.
- Reducers: assignment add/status/comment, spawn insertion, temp commit.
- Cost removal: project aggregates and expenses totals no longer reference `task.cost`, and nothing renders a task cost.

E2E (Playwright, through the pages), required before the change is reported complete:

- Owner creates a non-repeating task with an assignee; it appears in the project list and in the assignee's active list.
- Collaborator signs in: opens the projects section, sees no project they merely collaborate on, and sees only their own assignment in My Tasks; the project URL rejects them; they can set `in_progress`, cannot choose `done`.
- Owner sets the assignment to `done`; it leaves the collaborator's active list and appears under Past, read-only.
- A repeating task: the list shows the routine badge; completing an occurrence creates the next one with the advanced date; the previous occurrence sits in Past.
- Admin signs in: manages tasks and collaborators, cannot edit project details, delete the project, or change an admin.
- Editing a task's dates leaves its existing assignment's dates unchanged.

Each task ends with `pnpm verify` and `pnpm test:e2e` green, then a review of the uncommitted diff. The commit happens only after the user approves that task, and nothing is pushed without a separate go-ahead.

## Calls made here, for the reader to check

1. The assignment note is a single nullable `comment` field — no author, timestamps, or history.
2. Owners and admins may read and edit any assignment note; an assignee may edit their own inside their status rules.
3. `task_comment` stays the task-level thread; collaborators may read and write it only for tasks where they hold an open assignment.
4. Past means status `done` or `cancelled`.
5. Assignments are snapshots: created with their dates and never rewritten, including when the task's window or schedule changes.
6. On a repeating task, the assignment's `start_date` and `end_date` are the occurrence date at `startTime` and `endTime`; the task itself holds no occurrence date.
7. Completed occurrences are never deleted; re-assigning a removed person later starts a fresh row.
8. A task may have zero assignees.
9. The project card's counters stay task-level: total tasks, completed means every assignment is terminal. A repeating task with an open occurrence counts as incomplete.
10. Phase 1's form submits a single assignee id through the `assigneeIds` array.
11. Task costs are removed outright, including the project spent total's task component; no placeholder survives into the later cost model.
12. Membership, task, and routine data are all disposable; ownership stays with the project row.

## What is left to the builder

- Component decomposition and layout for the wizard step indicator, the repeat step, the task row, and the routine badge.
- Whether the repeat step is a separate step or a collapsible section inside step 1 (the design assumes a second step, mirroring the routine form).
- Exact SQL for the project-card aggregates.
- How the task list signals a repeating task that has ended (schedule passed, nothing open).
- Search, keyboard behavior, and empty states for the assignee select and the projects list.
- The mechanics of the truncate-and-backfill migration and verifying it against the e2e database.
