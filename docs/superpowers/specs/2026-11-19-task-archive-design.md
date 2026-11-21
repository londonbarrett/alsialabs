# Task Archive: Open/Archived Filter, Archive Actions, and Date-Edit Spawning

Date: 2026-11-19
Amended 2026-11-21: after implementation, user review reversed several
original decisions. Archiving no longer touches dates or times; archived
tasks are fully editable (the "freeze" was removed); the assignee column
is roster-driven; the archive confirm dialog only appears when there is
open work; and the two filter views stay mounted so view state survives
switches. Everything below describes the FINAL implemented behavior. A
few original lines are kept for context but explicitly marked superseded
where they conflict.

Background: supersedes the visibility-filter decisions of
`docs/superpowers/specs/2026-11-15-finished-tasks-design.md` (Decision
#1's three-way filter and anything that depended on it). The history
panel, recurrence-aware fetch, spawn guards, and transition rules from
that spec stay unless explicitly changed here.

## Intent

The Tasks card filters work by finished/unfinished state derived from
assignment statuses, but the user wants to _put work away_ rather than
watch it age out of a filter. Archiving is a deliberate, explicit act:
open a task's actions menu and choose Archive, and the task disappears
from the working queue into an Archived view. When the task still has
open assignments, a confirm dialog asks how to close them ("Mark as
done" / "Mark as cancelled"); when it has none, archiving happens
immediately with `closeAs: "cancelled"`. Assignment status remains real
and visible — it just stops being a filter dimension. Archiving never
changes dates or times, and archived tasks stay fully editable.

Concretely this design adds:

1. an `archived` boolean on `task`,
2. a **`task_assignee` table** — membership rows that are the source
   of truth for _who is assigned_ to a task, cleanly separating
   "removed" from "finished" (today both are just terminal
   `task_assignment` rows),
3. a two-way **Open / Archived** filter replacing
   unfinished/both/finished in the Tasks card,
4. **Archive** and **Unarchive** actions in the task actions menu.
   Archive sets only `task.archived = true` and closes all open
   assignments with the chosen done/cancelled disposition, spawning
   nothing. The confirm dialog appears only when there is open work to
   close. Archived tasks remain fully editable — no freeze.
5. **recurrence-checked spawning** on repeating tasks, unified into
   one helper invoked by four triggers — **unarchive, due-date
   change, assignment close, and add-assignee** — that opens an
   assignment for every active assignee who has none, whenever
   `computeNextOccurrence` lands in range.

## Goals

- Owner/admin can archive a task from its actions menu; the task
  leaves the Open list immediately and appears under Archived.
- Archiving asks the user how to close open assignments **only when
  the task has open assignments** (reuse the unassign
  `ActionConfirmDialog`: "Mark as done" / "Mark as cancelled"), closes
  every open assignment with that status, and spawns nothing. With
  zero open assignments, clicking Archive archives immediately with
  `closeAs: "cancelled"` — no dialog.
- **Archiving does not touch dates or times.** `startDate`, `endDate`,
  `startTime`, and `endTime` are preserved exactly. The original "set
  `endDate` to today" rule and its `archivedWindow` helper are removed
  (superseded).
- **Archived tasks are fully editable** (the original freeze was
  reversed after implementation): the edit form, priority, assignees,
  assignment status, Reopen, and comments all work on an archived
  task. Only `unarchiveTask` and `deleteTask` have special guards, and
  archived tasks never spawn new assignments — see the complete guard
  list in #6.
- Archived tasks can be unarchived from the actions menu (visible in
  the Archived view). Unarchiving a **repeating** task runs the
  recurrence-checked spawn immediately against its **preserved** due
  date; assignments otherwise stay closed.
- The Tasks card filter is exactly two options: **Open** (default) and
  **Archived**, partitioned on `task.archived`. No auto-flip. Both
  views stay mounted in React `<Activity mode="visible" | "hidden">`
  boundaries, so switching views preserves each view's local state.
- Assignment `status` is unchanged and still displayed in the status
  column — it simply no longer drives list membership. When a task has
  **no open assignments but closed history**, the status column reads
  "Done · N closed" (`projects.tasks.status.done` +
  `projects.tasks.closedCount`).
- Editing a repeating task's due date opens a fresh assignment for
  each **active assignee** (a `task_assignee` row) who has none open,
  when `computeNextOccurrence` from the new date yields an occurrence
  in range. Removed assignees get nothing. Non-repeating tasks never
  gain assignments from a date edit.
- **One spawn helper, four triggers** (repeating tasks only): a new
  open assignment is created when — (a) the task is unarchived,
  (b) the due date changes, (c) an assignment closes (the existing
  close-time cascade, now routed through the helper), (d) an
  assignee is added. Every trigger runs the same per-assignee check:
  active member + no open assignment + date in range → open one.
- **Removing an assignee ≠ removing from the project.** Unassigning
  deletes only that task's `task_assignee` row. Removing a person
  _from the project_ removes them from all its tasks: their
  `task_assignee` rows across the project's tasks are deleted (their
  open assignments are already cancelled today —
  `actions/projects/queries.ts:569` — that behavior stays).
- The edit form's assignee selection seeds from `task_assignee`, so a
  zero-open task (just unarchived, all finished) shows its assignees
  instead of an empty selection.
- The **assignee column is roster-driven**: avatars come strictly from
  the `task_assignee` roster (`task.assigneeIds` →
  `assigneeIdentities`), never from assignment rows. An empty roster
  shows "Unassigned" (`common.unassigned`); a user with only assignment
  history and no roster row is never displayed as assigned. The column
  header is the plural `projects.tasks.assignees`
  ("Assignees"/"Asignadas"); the singular `common.assignee` form label
  is unchanged.
- The task due-date column reads **`task.endDate` from the database**
  (not from assignment rows), and all-day tasks display the date only
  (`formatDueDate` + `isAllDayDate`). Assignment rows display their
  due date **with the time** via `formatAssignmentDueDate` (not a
  start–end date range).
- Spawn eligibility includes the project owner: `getActiveAssigneeIds`
  left-joins `project_membership` and also accepts
  `projects.primaryOwnerId`, because `createProject` never inserts a
  membership row for the primary owner — owning the project counts as
  holding a place.
- Calendar is untouched — it shows all assignment history, archived
  tasks included.
- My Tasks is untouched — it shows assignments, and archived tasks
  have none open, so they naturally drop out of Active (their closed
  rows remain reachable under Past, same as any closed assignment).

## Non-goals

- No data migration / no backfill in the local dev and test
  environments. The local `task`, `task_assignment`, and
  `task_assignee` tables are truncated; `archived` defaults to
  `false` and membership rows are created fresh for future tasks.
  **Caution:** a deployed database with pre-existing tasks still needs
  `task_assignee` backfilled from open `task_assignment` rows —
  otherwise those tasks have no roster and show "Unassigned" until
  assignees are re-added. (No automatic backfill is shipped.)
- No change to the calendar (reads `task_assignment_detail` by date
  range; no `archived` predicate).
- No change to My Tasks' active/past tabs or their server split.
- No change to assignment statuses, the history panel, or the
  transition rules of the 2026-11-15 spec. The status column keeps its
  existing counts but now also shows "Done · N closed" for zero-open
  tasks with closed history (see Goals). The
  close-time spawn cascade is refactored to route through the shared
  spawn helper (#7) but keeps its guards and anchor; archive
  suppresses it (#8).
- No auto-flip of the filter; no URL/store persistence for it (local
  `useState`, as today).
- No bulk archive; no archive from My Tasks or the calendar.
- Non-repeating tasks never gain new assignments from a date edit or
  unarchive (their exit from zero-open is the existing Reopen control
  or a remove/re-add through the wizard).
- No "archived" badge in the status column — archived state is
  communicated by which filter view the task is in.
- No count badges on the filter.
- No soft-delete on `task_assignee`: removal is a hard delete of the
  membership row (history lives in `task_assignment` and is never
  touched by removal).

## Decisions

### #1 Data: `archived` boolean on `task`

- `lib/drizzle/schema.ts` (`tasksTable`, lines 443-467): add
  `archived: boolean("archived").notNull().default(false)`.
- Generated with `pnpm db:generate` (never hand-edit `drizzle/`), then
  `pnpm db:migrate`. Default `false` means no data backfill; the user
  truncates the local tables anyway.
- `TaskRecordSchema` (`actions/tasks/schemas.ts:148-163`) gains
  `archived: z.boolean()`, flowing into `TaskWithAssignmentsSchema`
  and `TaskWithAssignmentsDTO`.
- `toTaskRecord` (`actions/tasks/queries.ts:81-99`) maps
  `row.archived`; every DTO construction site (e.g.
  `buildOptimisticTask` in `components/projects/tasks-card.tsx`,
  test fixtures) carries `archived`.

### #2 Data: new `task_assignee` table (membership source of truth)

Today the assignee roster is _derived_ from open assignment rows, so
"removed" and "finished" are indistinguishable (both terminal rows).
This table fixes that:

- `lib/drizzle/schema.ts`: new `taskAssigneesTable`
  (`pgTable("task_assignee", …)`):
  - `id` text PK (uuid default), `taskId` → `task.id`
    `onDelete: "cascade"`, `userId` → `user.id` `onDelete: "cascade"`,
    `createdAt`/`updatedAt` — mirror `task_assignment`'s conventions.
  - partial-free unique index on `(taskId, userId)` (plain unique is
    fine — one membership row per pair).
- Generated with `pnpm db:generate` / `pnpm db:migrate`.
- Semantics:
  - **Row exists** = the user is an active assignee of the task.
  - **Add assignee** (wizard) = insert membership row.
  - **Remove assignee** (wizard deselect or unassign dialog) = delete
    membership row, _and_ close their open assignment with the chosen
    disposition (done/cancelled) exactly as today — history is never
    deleted.
  - **Archive/unarchive** never touch membership — an archived task
    keeps its roster both for the unarchive spawn and for the
     roster-driven assignee column.
  - Cascade delete with the task; `deleteTask` needs no extra work.
- `syncTaskAssignments` (`actions/tasks/queries.ts:731-776`) becomes a
  membership sync with assignment side-effects:
  - diff `assigneeIds` against **`task_assignee`** (not open rows);
  - **new member** → insert membership, then run the spawn helper
    (#7): repeating task → range check decides whether an open row is
    created; non-repeating → insert the open row directly via
    `firstAssignmentWindow` (today's `toAdd` behavior — non-repeating
    tasks never range-check), **only when `!taskRow.archived`** — an
    archived task takes the roster row but never an open assignment;
  - **removed member** → delete membership + close their open row with
    `unassignAs[userId] ?? "cancelled"` (today's `toRemove` behavior;
    if they had no open row, just delete the membership);
  - **existing member with no open row** → _nothing_ on a plain save.
    Fresh open rows for existing members come only from the spawn
    triggers (#5 unarchive, #7 date change, close-time cascade, or
    Reopen) — a plain save (rename, priority) never reopens work.
    _Supersedes the 2026-11-15 spec's "the wizard is the universal
    way back to open work … submitting inserts fresh todo rows" for
    members who were never removed_: re-selecting a _removed_ person
    still works (membership re-insert → spawn helper), and
    non-repeating tasks keep the Reopen control.
- DTO: `TaskWithAssignmentsSchema` gains `assigneeIds:
z.array(z.string())` — the membership roster, so the form can seed
  from it. Loaded in `getTasksWithAssignments`/`getTaskWithAssignments`
  (one grouped query on `task_assignee`).
- Edit form seeding (`task-form.tsx:67-82`) reads `assigneeIds`
  instead of open-assignment users. Candidates shown in the picker
  remain current project members (membership rows for users who left
  the project are not seeded into the selection and are filtered from
  submission — `assertAssignees` already validates input ids).
- `seed-e2e.ts` inserts membership rows alongside its task/assignment
  fixtures.

### #3 Filter: Open / Archived

- `TasksVisibilityFilter` (`lib/tasks/list.ts:7`) becomes
  `"open" | "archived"`.
- `selectTasks(tasks, filter, now)` partitions on `task.archived`
  only. `shouldShowTask` (`lib/tasks/filter.ts:15-25`) is no longer
  used by the list — remove it and its tests if nothing else imports
  it; keep `isOpenAssignment` and `assignmentCounts` (the table still
  uses them).
- Ordering: both views sort by task `endDate` ascending, nulls last
  (unchanged convention; no finished/unfinished grouping to order).
- `components/projects/tasks-filter.tsx`: `OPTIONS = ["open",
"archived"]`; `tasks-card.tsx` default state `"open"`; the empty
  state switches between `noTasks` and a new `noArchived` key.
- Filter state stays local `useState` — no auto-flip, no URL, no
  store. `tasks-card.tsx` renders both views in React
  `<Activity mode="visible" | "hidden">` boundaries so the hidden view
  stays mounted and its local state is preserved across switches.

### #4 Archive action

**Server** (`actions/tasks/`):

- New action `archiveTask` in `actions.ts`, modelled on
  `deleteTask`/`updateTaskPriority`: `projectAction`, manager
  permission guard (same as edit), input `{ projectId, taskId,
closeAs: "done" | "cancelled" }`, output schema declared,
  `metadata.revalidate: ["/app/proyectos/:projectId"]`.
- New leaf query `archiveTaskRow(taskId, projectId, closeAs)` in
  `queries.ts`, one transaction:
  1. set **only** `task.archived = true` — dates and times
     (`startDate`, `endDate`, `startTime`, `endTime`) are preserved
     exactly. (The original "set `endDate = now`" step and the
     `archivedWindow` helper are superseded and removed.) The WHERE
     clause includes `archived = false`, so a second archive is a no-op
     at the DB level; the action also rejects an already-archived task
     via `assertTaskMutable`.
  2. close every open assignment of the task (`status = closeAs`) with
     a direct UPDATE that matches how `syncTaskAssignments` closes
     rows;
  3. **no spawn** — the spawn cascade lives in `updateAssignmentStatus`
     (the action), not in the status write, so closing via this query
     naturally spawns nothing;
  4. membership rows untouched.
- Export from `actions/tasks/index.ts` barrel.

**Store** (`stores/project-tasks/`):

- Reducer action `{ type: "setArchived"; taskId; archived }` (like
  `updateTaskPriority`), plus assignment updates for the closed rows
  (mirror `upsertAssignment`'s terminal handling without spawn; the
  commit re-seeds server truth via the existing revalidate/refetch
  path). The reducer never alters any date or time field.
- `use-project-tasks-actions.ts`: `archiveTask(closeAs)` running
  through `run`/`settle` with toasts (new `taskArchived` key).

**UI**:

- `tasks-card.tsx` destructures the new action and passes
  `onArchive` through `tasks-table.tsx` props into `ActionMenu`.
- Menu item **Archive** uses the `ActionConfirmDialog` pattern from
  `task-assignee-select.tsx:165-182` — title/message plus two
  actions, "Mark as done" and "Mark as cancelled" — each invoking
  `archiveTask` with the chosen `closeAs`. Only one dialog instance
  per row/menu. **The dialog is shown only when the task has open
  assignments** (`task.assignments.some(isOpenAssignment)`); with zero
  open assignments there is no disposition to choose, so clicking
  Archive immediately calls `archiveTask` with `closeAs: "cancelled"`.
- New i18n keys under `projects.tasks.archive.*` (title, message,
  markDone, markCancelled) mirroring `unassign.*`
  (`messages/en.json:312-317`); `archiveTask`/`unarchiveTask` menu
  labels.
- Permission: same gate as Edit (`canEdit` / manager + `projects:edit`
  — the `canMutate` computation in `tasks-table.tsx:62-67`).

### #5 Unarchive action

- New action `unarchiveTask` (input `{ projectId, taskId }`), one
  transaction:
  1. set `archived = false`, guarded by a WHERE `archived = true` plus
     a returned row count (a missing/already-unarchived row yields
     `NOT_FOUND`; the action also rejects `!task.archived` with
     `VALIDATION_FAILED` before the write);
  2. **run the spawn helper (#7) immediately** — trigger (a). The due
     date is the **preserved** `task.endDate` (archive never changed
     it), so if the recurrence calculator yields an occurrence in
     range (≤ `endOfDay(endDate)`), open assignments for every active
     assignee without one. `spawnEligibleAssignments` re-reads the task
     inside the transaction, so rule 0 sees `archived = false` as just
     written.
  3. Non-repeating tasks: no spawn (membership and closed history stay
     as-is).
- Same permission guard, revalidate, output schema.
- Reducer action `{ type: "setArchived"; taskId; archived: false }`
  (same case as archive) + optimistic assignment rows for any spawned
  occurrences (commit re-seeds).
- Menu item **Unarchive** shown instead of Archive when the task is
  archived. No dialog — unarchive is not destructive.
- i18n: `projects.tasks.unarchiveTask` menu label + `taskUnarchived`
  toast.

### #6 Menu, views, and the remaining archived guards

- `ActionMenu` (`components/common/action-menu.tsx`) keeps its
  `children` slot: `tasks-table.tsx` composes Archive/Unarchive items
  as children (pattern: `expenses-table.tsx:108-119`) rather than
  growing `ActionMenuProps`. Which item renders is decided by
  `task.archived`.
- **Archived view** (same table, `archived` rows): the row is a normal
  editable row — Archive becomes Unarchive, and **Edit, priority,
  assignee selection, assignment status, Reopen, and comments all
  remain available**. Delete also stays available. (Supersedes the
  original "Edit hidden / read-only row" decision.)
- **The complete list of remaining archived guards.** The freeze was
  removed, but the following checks stay and are the only special
  handling for archived tasks:
  1. `spawnEligibleAssignments` **rule 0**: `if (!task || task.archived ||
     !task.recurrence) return []` — an archived task opens assignments
     under no circumstance. The `!row.archived` gate on the close-time
     cascade's spawn descriptor is part of this defence.
  2. `syncTaskAssignments`' non-repeating direct insert is gated by
     `!taskRow.archived` — an archived task gets the roster row but no
     new open assignment (#2).
  3. `archiveTask` rejects an already-archived task via
     `assertTaskMutable`, and `archiveTaskRow`'s UPDATE includes
     `archived = false` in its WHERE (#4).
  4. `unarchiveTask` rejects `!task.archived` with `VALIDATION_FAILED`
     before the write; `unarchiveTaskRow`'s UPDATE includes
     `archived = true` in its WHERE and checks the returned row count
     (`NOT_FOUND` when nothing was flipped) (#5).
  5. **No mutation action freezes on `archived = true` any more**:
     `updateTask`, `updateAssignmentStatus`, `updateAssignmentComment`,
     `updateTaskPriority`, and comment CRUD all work on archived tasks.
- Archive while viewing Open: task disappears from the current list
  (the filter does not auto-flip; the user switches to Archived
  themselves). Both views stay mounted in `<Activity mode="visible" |
  "hidden">` boundaries, so view state is preserved across switches.

### #7 The spawn helper: one rule, four triggers

Today only `updateAssignmentStatus` spawns (close-time cascade), and
`updateTask` never touches assignments. Consolidate into one helper —
a leaf query `spawnEligibleAssignments(taskId, opts)` in `queries.ts`
— invoked from four places. **Repeating tasks only** (non-repeating:
the helper is never called from triggers (a)/(b)/(d); see below).

**The rule (per assignee, evaluated for every active member):**

0. **Archived → no spawn, ever.** The helper's very first statement
   is `if (!task || task.archived || !task.recurrence) return []` — an
   archived task opens new assignments under no circumstance,
   regardless of which trigger called the helper. This is the single,
   obvious enforcement point; the per-trigger gates and the other
   remaining guards (#6) are defence in depth. (Archived tasks are
   editable, so this rule — not a mutation freeze — is what prevents
   spawning.)
1. **Active member**: has a `task_assignee` row and still holds a
   place on the project. `getActiveAssigneeIds` left-joins
   `project_membership` and also accepts `projects.primaryOwnerId`,
   because `createProject` never inserts a membership row for the
   primary owner — owning the project counts as holding a place.
   Someone removed from the project has neither membership nor
   ownership, so they're never candidates (see #9).
2. **No open assignment** for that `(taskId, userId)` — the partial
   unique index `task_assignment_open_unique` can't trip.
3. **Date in range**: `computeNextOccurrence({ recurrence, interval,
daysOfWeek, startTime, endTime, endDate: task.endDate }, <anchor>)`
   returns a non-null occurrence at or before `endOfDay(endDate)`.
   The anchor is trigger-specific (below).

If all three hold → insert an open (`todo`) assignment with the
computed window (same column set as today's close-time spawn insert).

**Triggers:**

| #   | Trigger              | Where                                                                                  | Anchor                                                                                         |
| --- | -------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| (a) | Unarchive            | `unarchiveTask` (#5)                                                                   | now                                                                                            |
| (b) | Due date changed     | `updateTask`, after `updateTaskRow`                                                    | new due date (builder: new `startDate` if set, else now)                                       |
| (c) | An assignment closes | existing close-time cascade in `updateAssignmentStatus`, refactored to call the helper | the closing row's date (preserves the 2026-11-15 "late close spawns backdated successor" rule) |
| (d) | Assignee added       | `syncTaskAssignments` new-member path (#2)                                             | now                                                                                            |

Notes:

- **Trigger (c) today only spawns for the closing assignee.** Routed
  through the helper it evaluates _all_ active members — in normal
  operation everyone else already has an open row (rule 2 filters them
  out), so behavior is unchanged; the helper additionally heals any
  member left without an open row (e.g. someone whose date-edit spawn
  was out of range at the time). Accepted widening; the closing
  assignee's spawn keeps its existing guards (`hasLaterDatedAssignment`,
  terminal-crossing gate).
- **Trigger (d) on a non-repeating task** does not range-check: it
  inserts the open row directly via `firstAssignmentWindow` (today's
  behavior — you must be able to assign someone to a one-off task).
  Range-checking is a repeating-only concept.
- **Trigger (b) gate**: run only when `recurrence != null` **and**
  `endDate` actually changed. Rule 0 is the single, authoritative
  archived check — an archived task can now be edited, so the helper
  itself is what prevents a date edit from spawning on it.
  Trigger (a) runs only when `recurrence != null`. Trigger (c) keeps
  its existing recurrence gate. Trigger (d) runs for every new member
  on a repeating task.
- **Ordering vs. `syncTaskAssignments`** on `updateTask`: builder's
  call, but the two never double-insert — sync no longer inserts for
  existing members, and a member who just received an open row from
  one trigger is filtered out by rule 2 in the next.
- `firstAssignmentWindow`'s known quirk (ignores task `endDate`) does
  not apply to the helper: it always range-checks via
  `computeNextOccurrence`.

### #8 Spawn suppression on archive (explicit)

- `archiveTaskRow` closes assignments with a direct status UPDATE —
  it does not call `updateAssignmentStatus`, so the close-time spawn
  cascade never runs.
- Defensive: `updateAssignmentStatus`'s spawn block gains an early
  exit when `task.archived` is true (covers any future call path that
  tries to close an archived task's rows).
- Unit test: archiving a repeating task with an open assignment
  inserts **no** successor row.

### #9 Removing a project member removes them from the project's tasks

- Distinction (decided): **unassigning** someone from a task deletes
  only that task's `task_assignee` row — they remain a project member
  and stay assigned to their other tasks. **Removing someone from the
  project** deletes all their `task_assignee` rows across every task
  in that project.
- The existing behavior of cancelling their open assignments on
  project-member removal (`actions/projects/queries.ts:569`, covered
  by `project-membership.test.ts:206`) stays exactly as-is; the new
  cleanup is the membership rows, in the same transaction as part of
  the member-removal query in `actions/projects/queries.ts`.
- Consequence: after project-member removal there is nothing left to
  spawn for that user — rule 1 of the spawn helper (#7) finds no
  membership row. No intersection check is strictly required, though
  keeping the `project_membership` intersection in the helper is
  cheap defence against drift (e.g. rows orphaned by future code
  paths).

### #10 Translations

`messages/en.json` and `messages/es.json` stay structurally identical.

| Key                                                    | en                                                                                                                             | es                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects.tasks.open`                                  | Open                                                                                                                           | Abiertas                                                                                                                                          |
| `projects.tasks.archived`                              | Archived                                                                                                                       | Archivadas                                                                                                                                        |
| `projects.tasks.noArchived`                            | No archived tasks yet                                                                                                          | Aún no hay tareas archivadas                                                                                                                      |
| `projects.tasks.filterLabel` (reuse, reword if needed) | Task visibility filter                                                                                                         | Filtro de visibilidad de tareas                                                                                                                   |
| `projects.tasks.archive.title`                         | Archive task?                                                                                                                  | ¿Archivar tarea?                                                                                                                                  |
| `projects.tasks.archive.message`                       | This closes all open assignments and moves the task to Archived. Completed history is kept and no more occurrences will spawn. | Esto cierra todas las asignaciones abiertas y mueve la tarea a Archivadas. El historial completado se conserva y no se generarán más ocurrencias. |
| `projects.tasks.archive.markDone`                      | Mark as done                                                                                                                   | Marcar como finalizada                                                                                                                            |
| `projects.tasks.archive.markCancelled`                 | Mark as cancelled                                                                                                              | Marcar como cancelada                                                                                                                             |
| `projects.tasks.archiveTask`                           | Archive                                                                                                                        | Archivar                                                                                                                                          |
| `projects.tasks.unarchiveTask`                         | Unarchive                                                                                                                      | Desarchivar                                                                                                                                       |
| `projects.tasks.taskArchived`                          | Task archived                                                                                                                  | Tarea archivada                                                                                                                                   |
| `projects.tasks.taskUnarchived`                        | Task restored                                                                                                                  | Tarea restaurada                                                                                                                                  |
| `projects.tasks.assignees` (column header, plural)     | Assignees                                                                                                                      | Asignadas                                                                                                                                         |
| `projects.tasks.status.done` (status "Done" part)      | Done                                                                                                                           | Finalizada                                                                                                                                        |
| `projects.tasks.closedCount` (status "N closed" part)  | `{count, plural, ...}`                                                                                                         | `{count, plural, ...}`                                                                                                                            |
| `common.unassigned` (empty-roster cell)                | Unassigned                                                                                                                     | Sin asignar                                                                                                                                       |

The singular `common.assignee` form label is unchanged. The assignee
column uses the plural `projects.tasks.assignees` header. Dynamic
key maps (`errors.*`, `projects.tasks.status.*`,
`projects.tasks.closedCount`, `activities.*`, etc.) are looked up by
value and are **never renamed or merged**; only add keys. en/es stay
structurally identical.

Remove (if orphaned): `projects.tasks.both`, `unfinished`, `finished`,
`noFinished` — check no other consumer first (`myTasks.*` is a
different namespace and stays).

## Testing

- **Unit (vitest, beside the file):**
  - `lib/tasks/list.test.ts`: rewrite `selectTasks` cases for
    open/archived partition + endDate ordering; drop
    `shouldShowTask`-driven cases.
  - `lib/drizzle/schema.test.ts`: `tasksTable.archived` default false;
    `taskAssigneesTable` defined with unique `(taskId, userId)` and
    cascades (mirror existing assertions).
  - `actions/tasks/tasks.test.ts`:
    - `archiveTask` sets `archived=true` only — `startDate`, `endDate`,
      `startTime`, `endTime` are unchanged — closes all open rows with
      `closeAs`, spawns nothing (repeating fixture), leaves membership
      untouched; a second archive of an already-archived task is
      rejected;
    - `unarchiveTask` (trigger a): repeating + in-range date → spawns
      for every active assignee without an open row; out of range →
      nothing; non-repeating → nothing; removed assignee (no
      membership) → never spawned;
    - date-edit spawn (trigger b): repeating task + due-date change +
      active member with no open row → one insert with the computed
      window; member with an open row → no insert; removed assignee →
      no insert; non-repeating → no insert; due date unchanged → no
      insert; occurrence out of range → no insert;
    - close-time spawn (trigger c): refactored through the helper —
      closing assignee still spawns with the closing row's date as
      anchor and keeps `hasLaterDatedAssignment`; a second active
      member with no open row and an in-range date is healed too; a
      member with an open row is untouched;
    - add-assignee (trigger d): repeating + new member → membership +
      range-checked open row (out of range → membership only, no
      open row); non-repeating + new member → membership +
      `firstAssignmentWindow` row (no range check);
    - `syncTaskAssignments`: removed member → membership deleted + open
      row closed with `unassignAs` disposition; existing member with
      no open row → **no insert** on plain save;
    - **no freeze** (supersedes the original freeze test): `updateTask`,
      `updateAssignmentStatus`, `updateAssignmentComment`,
      `updateTaskPriority`, Reopen, and all comment actions succeed on
      an archived task; only the guards in #6 reject: double-archive →
      error, `unarchiveTask` on a live task → `VALIDATION_FAILED`, a
      vanished row → `NOT_FOUND`, an archived non-repeating
      add-assignee → roster row only, no open assignment;
    - spawn helper: called directly with an archived task → returns
      immediately, inserts nothing (the rule-0 gate);
    - `updateAssignmentStatus`'s `!row.archived` spawn-descriptor gate
      keeps a close on an archived task from spawning;
    - `getActiveAssigneeIds` includes `projects.primaryOwnerId` even
      with no `project_membership` row;
    - `assigneeIdentities` uses only roster ids: a task with an empty
      `assigneeIds` yields no avatars even if assignment rows exist;
    - `formatDueDate`/`isAllDayDate` drop the time for all-day task
      dates, while `formatAssignmentDueDate` always includes it.
  - `actions/projects/project-membership.test.ts`: member removal
    deletes that user's `task_assignee` rows across the project's
    tasks (existing open-assignment cancellation test stays).
  - `stores/project-tasks/project-tasks-store.test.ts`: `setArchived`
    reducer case; archive commit reflects closed assignment rows.
  - `actions/tasks/schemas.test.ts`: `archived` in `TaskRecordSchema`,
    `assigneeIds` in `TaskWithAssignmentsSchema`.
  - Form seeding: unit coverage that `task-form` seeds selection from
    `assigneeIds` (zero-open task shows its roster).
- **E2E (Playwright, through the pages, `signInAs` fixtures):**
  - `e2e/task-filter.spec.ts` is rewritten around the new filter:
    open list default; Archive from the actions menu of a task with
    open assignments → dialog with "Mark as done"/"Mark as cancelled"
    → confirm → task gone from Open → switch to Archived → task
    present and **fully editable**, Unarchive in its menu → unarchive
    (repeating, in-range → assignments reopen immediately; otherwise
    none) → back under Open; archiving a task with **zero open
    assignments archives immediately with no dialog**; archive with a
    repeating task spawns no successor; empty states per view; no
    auto-flip.
  - **Editable archived view:** the archived row still has Edit, status
    selects, Reopen, priority select, and comment input — e2e asserts
    editing an archived task works (edit form, priority, assignees,
    assignment status, Reopen, comments). Delete and Unarchive are
    present.
  - **Roster avatars:** the assignee column shows avatars only for
    `task_assignee` roster ids (`common.unassigned` when empty); a
    closed assignment row's user is never shown as assigned. The
    column header is the plural `projects.tasks.assignees`.
  - **Status column:** a task with no open assignments but closed
    history reads "Done · N closed"
    (`projects.tasks.status.done` + `projects.tasks.closedCount`).
  - **Due dates:** the task due cell matches `task.endDate` read from
    the database, and all-day tasks show the date only; assignment
    rows show their due date **with the time** via
    `formatAssignmentDueDate`. Archive/unarchive never changes dates.
  - **Preserved view state:** after switching Open → Archived → Open,
    the filter view's local state (e.g. expanded history panel) is
    unchanged — both views stay mounted in React `Activity` boundaries.
  - Date-edit spawn: zero-open repeating task → edit due date → new
    open assignment appears; a removed assignee does not come back.
  - Removed vs finished: unassign someone (membership gone) → change
    due date → only remaining active assignees spawn.
  - Add-assignee spawn: add a member to a repeating task with an
    in-range date → they get an open assignment; remove a member from
    the project → their membership rows are gone (asserted indirectly:
    a later date change never spawns for them).
  - Existing specs touching the old filter labels
    (`task-filter.spec.ts` throughout, anything asserting
    "Finalizadas"/"Sin finalizar"/"Ambas") are updated; specs pinning
    unrelated behavior (`multi-assignee.spec.ts`,
    `repeating-tasks.spec.ts`, `task-assignments.spec.ts`) must keep
    passing — audit their filter assumptions and any wizard-save
    reopen expectations (superseded per #2).
  - Menu-item assertions follow the existing pattern
    (`multi-assignee.spec.ts:151-154`).
- **Gates:** `pnpm verify` and `pnpm test:e2e`.

## Risks and edge cases

- **Behavior change on wizard save (supersession):** a plain save no
  longer reopens assignments for existing members (fresh rows come
  from spawn paths, Reopen, or remove/re-add). Finished tasks edited
  for unrelated reasons stay finished — intended, but e2e and specs
  assuming the old "wizard is the universal way back" must be audited
  (recorded above).
- **Archive of a repeating task with recurrence:** the due date is
  preserved and spawn is suppressed; unarchive re-runs the check
  against that preserved date, so a still-in-range task revives on
  unarchive alone; otherwise the user edits the due date before or
  after unarchive (the exit). A non-repeating unarchived task sits
  zero-open until Reopen or remove/re-add — accepted.
- **Due-date display:** the task due cell always reads `task.endDate`
  from the database (never an assignment row), with all-day dates
  rendered date-only by `formatDueDate`/`isAllDayDate`; assignment
  rows use `formatAssignmentDueDate` and therefore always include the
  time. The superseded "lead assignment fallback / now today's date"
  concern no longer applies.
- **Date-edit spawn vs. `hasLaterDatedAssignment` guard:** a fresh
  spawn inserted by the date edit is the latest-dated row for that
  assignee, so the existing close-time guard 4 still behaves. No
  interaction expected.
- **Archived editing vs. stale clients (supersedes the freeze risk):**
  archived tasks are editable, so a stale tab can submit an edit
  normally; there is no freeze rejection. Only the guards in #6 apply
  (e.g. a second archive or an unarchive of a live row is rejected and
  surfaces as a toast/action error, never a crash).
- **Membership vs. project membership drift:** project-member removal
  deletes membership rows (#9); the helper also intersects with
  `project_membership` as cheap defence. Orphaned rows (future code
  paths) are never spawned into while the intersection holds.
- **Close-time helper widening:** trigger (c) now evaluates all
  members, not just the closer. In normal operation the extra
  candidates are filtered out (they have open rows); the observable
  change is healing a member left rowless by an out-of-range date —
  accepted as more correct.
- **Concurrent edit/archive:** archive and edit racing is backstopped
  by the `archived = false` WHERE in `archiveTaskRow`, the
  `archived = true` WHERE + row-count in `unarchiveTaskRow`, and the
  same unique index / stale-write patterns already handled; worst case
  a rejected write surfaces as `VALIDATION_FAILED` or `NOT_FOUND`.
- **Filter removal fallout:** anything importing
  `TasksVisibilityFilter`'s old members or `shouldShowTask` breaks at
  typecheck — the compiler finds them all.
- **Expenses page** mounts `ProjectTasksProvider` without the card —
  unaffected except its seeded tasks now carry `archived` and
  `assigneeIds`.

## Post-implementation revisions (2026-11-21)

User review after implementation finalized these behaviors (each
supersedes the corresponding original line above):

1. **No date/time changes on archive.** Archive sets only
   `task.archived = true` and closes open assignments with the chosen
   `done`/`cancelled` disposition; it spawns nothing. The `endDate = now`
   step and the `archivedWindow` helper are gone. All of `startDate`,
   `endDate`, `startTime`, `endTime` are preserved exactly.
2. **No archived freeze.** Archived tasks are fully editable (form,
   priority, assignees, assignment status, Reopen, comments). Only the
   guards summarized in #6 remain: rule 0 in `spawnEligibleAssignments`
   (archived → `[]`), the `!row.archived` descriptor gate in the
   close-time cascade, the `!archived` gate on `syncTaskAssignments`'s
   non-repeating direct insert, `archiveTask`'s double-archive
   rejection, `unarchiveTask`'s `!archived → VALIDATION_FAILED` check
   plus WHERE and row-count guard, and `archiveTaskRow`'s
   `archived = false` WHERE.
3. **Roster-driven assignee column.** Avatars come strictly from the
   `task_assignee` roster (`task.assigneeIds` → `assigneeIdentities`);
   an empty roster shows "Unassigned" and an assignment-row user is
   never shown as assigned. The header is plural
   `projects.tasks.assignees`; the singular `common.assignee` form
   label is unchanged.
4. **Archive confirm dialog only with open work.** With zero open
   assignments, archiving happens immediately with `closeAs:
   "cancelled"`; no disposition dialog is shown.
5. **Status column "Done · N closed".** A task with no open assignments
   but closed history shows `projects.tasks.status.done` plus
   `projects.tasks.closedCount`.
6. **Due dates.** The task due column reads `task.endDate` from the
   database (not assignment rows), with all-day dates formatted
   date-only (`formatDueDate`/`isAllDayDate`); assignment rows show
   their due date with time via `formatAssignmentDueDate`.
7. **Owner is spawn-eligible.** `getActiveAssigneeIds` left-joins
   `project_membership` and also accepts `projects.primaryOwnerId`
   because the primary owner has no membership row.
8. **View state preserved.** `tasks-card.tsx` renders both Open and
   Archived views in React `<Activity mode="visible" | "hidden">`
   boundaries so the hidden view stays mounted.
9. **E2E/fixtures.** Seed-e2e membership rows exist; archived-task
   tests assert editability, roster avatars, "Done · N closed",
   DB-sourced task due date, assignment due-date+time, and preserved
   view state.
10. **No data migration / no backfill** remains the policy, with the
    standing warning that a deployed DB holding pre-existing tasks
    needs `task_assignee` backfilled from open `task_assignment` rows.
11. **en/es structural parity** and the rule that dynamic key maps are
    never renamed are unchanged.

## Calls I made (builder's discretion, flag if wrong)

- Freeze scope (**SUPERSEDED 2026-11-21**): the freeze was removed
  after user review. Archived tasks are fully editable; only the
  guards in #6 remain. Edit, status, priority, assignees, Reopen, and
  comments all work in the Archived view.
- `deleteTask` remains available on archived tasks.
- `syncTaskAssignments` never inserts for existing members — the
  2026-11-15 "wizard reopens finished work" path is superseded as
  described in #2 (Reopen for non-repeating, spawn triggers for
  repeating, remove/re-add for explicit reassignment).
- Trigger (c) widening: the close-time cascade evaluates all active
  members through the helper, not just the closing assignee (healing
  effect; normally no observable change).
- Spawn roster and form seeding intersect membership with current
  project members as defence; project-member removal itself deletes
  membership rows (#9).
- `task_assignee` removal is a hard delete (no `removedAt` marker).
- Freeze error code (**SUPERSEDED 2026-11-21**): there are no frozen
  mutations. The archive-specific errors are `FORBIDDEN` for a
  double-archive attempt (via `assertTaskMutable`) and
  `VALIDATION_FAILED` / `NOT_FOUND` for the unarchive guards (#6).
- Assignee selection in the form seeds from `assigneeIds` including
  members with no open rows, so zero-open tasks show their roster.

## Left to the builder

- Exact anchor passed to `computeNextOccurrence` (new `startDate` vs.
  now) as long as "in range" semantics hold; spawn block ordering
  relative to `syncTaskAssignments`.
- Toast copy nuances; whether Unarchive also toasts a "change the due
  date to reopen assignments" hint when nothing spawned.
- Filter control styling within the header (segmented buttons, same
  component with new options).
- Whether the archive dialog reuses `unassign.*` message keys with a
  different title or fully separate `archive.*` keys (spec leans
  separate; wording is interchangeable).
