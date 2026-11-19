# Task Archive: Open/Archived Filter, Archive Actions, and Date-Edit Spawning

Date: 2026-11-19
Background: supersedes the visibility-filter decisions of
`docs/superpowers/specs/2026-11-15-finished-tasks-design.md` (Decision
#1's three-way filter and anything that depended on it). The history
panel, recurrence-aware fetch, spawn guards, and transition rules from
that spec stay unless explicitly changed here.

## Intent

The Tasks card filters work by finished/unfinished state derived from
assignment statuses, but the user wants to _put work away_ rather than
watch it age out of a filter. Archiving is a deliberate, explicit act:
open a task's actions menu, choose Archive, confirm how its open
assignments close, and the task disappears from the working queue into
an Archived view. Assignment status remains real and visible — it just
stops being a filter dimension.

Concretely this design adds:

1. an `archived` boolean on `task`,
2. a **`task_assignee` table** — membership rows that are the source
   of truth for _who is assigned_ to a task, cleanly separating
   "removed" from "finished" (today both are just terminal
   `task_assignment` rows),
3. a two-way **Open / Archived** filter replacing
   unfinished/both/finished in the Tasks card,
4. **Archive** and **Unarchive** actions in the task actions menu,
   with a confirm dialog that closes all open assignments (done or
   cancelled) and suppresses spawning; archived tasks are completely
   frozen,
5. **recurrence-checked spawning** on repeating tasks, unified into
   one helper invoked by four triggers — **unarchive, due-date
   change, assignment close, and add-assignee** — that opens an
   assignment for every active assignee who has none, whenever
   `computeNextOccurrence` lands in range.

## Goals

- Owner/admin can archive a task from its actions menu; the task
  leaves the Open list immediately and appears under Archived.
- Archiving asks the user how to close open assignments (reuse the
  unassign `ActionConfirmDialog`: "Mark as done" / "Mark as
  cancelled"), closes every open assignment with that status, and
  spawns nothing.
- Archiving sets the task's due date to the current date.
- Archived tasks are **completely frozen**: the server rejects every
  task/assignment mutation while `archived = true` except
  `unarchiveTask` and `deleteTask`.
- Archived tasks can be unarchived from the actions menu (visible in
  the Archived view). Unarchiving a **repeating** task runs the
  recurrence-checked spawn immediately (the due date is today, from
  archive); assignments otherwise stay closed.
- The Tasks card filter is exactly two options: **Open** (default) and
  **Archived**, partitioned on `task.archived`. No auto-flip.
- Assignment `status` is unchanged and still displayed in the status
  column — it simply no longer drives list membership.
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
- Calendar is untouched — it shows all assignment history, archived
  tasks included.
- My Tasks is untouched — it shows assignments, and archived tasks
  have none open, so they naturally drop out of Active (their closed
  rows remain reachable under Past, same as any closed assignment).

## Non-goals

- No data migration. The local `task`, `task_assignment`, and
  `task_assignee` tables are truncated; `archived` defaults to
  `false` and membership rows are created fresh for future tasks.
- No change to the calendar (reads `task_assignment_detail` by date
  range; no `archived` predicate).
- No change to My Tasks' active/past tabs or their server split.
- No change to assignment statuses, the status column display, the
  history panel, or the transition rules of the 2026-11-15 spec. The
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
    keeps its roster for the unarchive spawn.
  - Cascade delete with the task; `deleteTask` needs no extra work.
- `syncTaskAssignments` (`actions/tasks/queries.ts:731-776`) becomes a
  membership sync with assignment side-effects:
  - diff `assigneeIds` against **`task_assignee`** (not open rows);
  - **new member** → insert membership, then run the spawn helper
    (#7): repeating task → range check decides whether an open row is
    created; non-repeating → insert the open row directly via
    `firstAssignmentWindow` (today's `toAdd` behavior — non-repeating
    tasks never range-check);
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
  store.

### #4 Archive action

**Server** (`actions/tasks/`):

- New action `archiveTask` in `actions.ts`, modelled on
  `deleteTask`/`updateTaskPriority`: `projectAction`, manager
  permission guard (same as edit), input `{ projectId, taskId,
closeAs: "done" | "cancelled" }`, output schema declared,
  `metadata.revalidate: ["/app/proyectos/:projectId"]`.
- New leaf query `archiveTaskRow(taskId, projectId, closeAs)` in
  `queries.ts`, one transaction:
  1. set `task.archived = true` and `task.endDate = now`;
  2. close every open assignment of the task (`status = closeAs`,
     match how `syncTaskAssignments` closes rows);
  3. **no spawn** — the spawn cascade lives in `updateAssignmentStatus`
     (the action), not in the status write, so closing via this query
     naturally spawns nothing. Guard against any shared helper that
     would spawn.
  4. membership rows untouched.
- Export from `actions/tasks/index.ts` barrel.

**Store** (`stores/project-tasks/`):

- Reducer action `{ type: "setArchived"; taskId; archived }` (like
  `updateTaskPriority`), plus assignment updates for the closed rows
  (mirror `upsertAssignment`'s terminal handling without spawn; the
  commit re-seeds server truth via the existing revalidate/refetch
  path).
- `use-project-tasks-actions.ts`: `archiveTask(closeAs)` running
  through `run`/`settle` with toasts (new `taskArchived` key).

**UI**:

- `tasks-card.tsx` destructures the new action and passes
  `onArchive` through `tasks-table.tsx` props into `ActionMenu`.
- Menu item **Archive** uses the `ActionConfirmDialog` pattern from
  `task-assignee-select.tsx:165-182` — title/message plus two
  actions, "Mark as done" and "Mark as cancelled" — each invoking
  `archiveTask` with the chosen `closeAs`. Only one dialog instance
  per row/menu.
- New i18n keys under `projects.tasks.archive.*` (title, message,
  markDone, markCancelled) mirroring `unassign.*`
  (`messages/en.json:312-317`); `archiveTask`/`unarchiveTask` menu
  labels.
- Permission: same gate as Edit (`canEdit` / manager + `projects:edit`
  — the `canMutate` computation in `tasks-table.tsx:62-67`).

### #5 Unarchive action

- New action `unarchiveTask` (input `{ projectId, taskId }`), one
  transaction:
  1. set `archived = false`;
  2. **run the spawn helper (#7) immediately** — trigger (a). The due
     date is today (set at archive), so if the recurrence calculator
     yields an occurrence in range (≤ `endOfDay(endDate)`), open
     assignments for every active assignee without one. This makes
     either order work: edit-while-archived can't happen (frozen), but
     a task whose date already qualifies returns to work the moment
     it's unarchived.
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

### #6 Menu, views, and the archived freeze

- `ActionMenu` (`components/common/action-menu.tsx`) keeps its
  `children` slot: `tasks-table.tsx` composes Archive/Unarchive items
  as children (pattern: `expenses-table.tsx:108-119`) rather than
  growing `ActionMenuProps`. Which item renders is decided by
  `task.archived`.
- **Archived view** (same table, `archived` rows):
  - menu shows **Unarchive** + **Delete** (delete stays available —
    cleanup must be possible; my call);
  - **Edit is hidden**, and the row is read-only: no status selects,
    no Reopen, no priority select, no comment input (my call, direct
    consequence of "completely frozen");
- **Server freeze** (defence in depth, not just hidden UI): every
  mutation action checks `task.archived` and rejects while true —
  `updateTask`, `updateAssignmentStatus`, `updateAssignmentComment`,
  `updateTaskPriority`, comment CRUD — with the appropriate existing
  error code (`FORBIDDEN` or `VALIDATION_FAILED`, builder's call).
  `unarchiveTask` and `deleteTask` are the only exceptions. This
  covers stale tabs and direct calls.
- Archive while viewing Open: task disappears from the current list
  (the filter does not auto-flip; the user switches to Archived
  themselves).

### #7 The spawn helper: one rule, four triggers

Today only `updateAssignmentStatus` spawns (close-time cascade), and
`updateTask` never touches assignments. Consolidate into one helper —
a leaf query `spawnEligibleAssignments(taskId, opts)` in `queries.ts`
— invoked from four places. **Repeating tasks only** (non-repeating:
the helper is never called from triggers (a)/(b)/(d); see below).

**The rule (per assignee, evaluated for every active member):**

0. **Archived → no spawn, ever.** The helper's very first statement
   is `if (task.archived) return` — an archived task opens new
   assignments under no circumstance, regardless of which trigger
   called the helper. This is the single, obvious enforcement point;
   the per-trigger gates and the mutation freeze (#6) remain as
   defence in depth.
1. **Active member**: has a `task_assignee` row and is still in
   `project_membership` (someone removed from the project has no
   membership rows — see #9 — so they're never candidates).
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
  `endDate` actually changed **and** `task.archived` is false
  (defensive — archived tasks are frozen and can't reach this code).
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
    - `archiveTask` sets `archived=true`, `endDate=now`, closes all
      open rows with `closeAs`, spawns nothing (repeating fixture),
      leaves membership untouched;
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
    - freeze: `updateTask`, `updateAssignmentStatus`,
      `updateTaskPriority`, comment actions all reject while
      `archived=true`; `deleteTask` and `unarchiveTask` succeed;
    - spawn helper: called directly with an archived task → returns
      immediately, inserts nothing (the rule-0 gate);
    - `updateAssignmentStatus` spawn early-exit when archived.
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
    open list default; Archive from the actions menu → dialog with
    "Mark as done"/"Mark as cancelled" → confirm → task gone from
    Open → switch to Archived → task present, read-only row, Unarchive
    in its menu → unarchive (repeating, in-range → assignments reopen
    immediately; otherwise none) → back under Open; archive with a
    repeating task spawns no successor; empty states per view; no
    auto-flip.
  - Frozen view: archived row has no status select, no Reopen, no
    Edit menu item; Delete still present.
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
- **Archive of a repeating task with recurrence:** due date set to
  today + spawn suppressed; unarchive re-runs the check against
  today's date, so a still-in-range task revives on unarchive alone;
  otherwise the user edits the due date after unarchive (the exit).
  A non-repeating unarchived task sits zero-open until Reopen or
  remove/re-add — accepted.
- **Due-date cell display:** the table's due cell prefers the lead
  assignment's `endDate`, falling back to `task.endDate`. After
  archive all assignments are closed — confirm the cell falls back to
  the task's (now today's) date rather than a stale assignment date;
  if not, adjust the fallback order for zero-open tasks.
- **Date-edit spawn vs. `hasLaterDatedAssignment` guard:** a fresh
  spawn inserted by the date edit is the latest-dated row for that
  assignee, so the existing close-time guard 4 still behaves. No
  interaction expected.
- **Freeze vs. stale clients:** a tab that loaded before archive can
  still submit edits; the server-side freeze is the backstop and
  surfaces as a toast, never a crash.
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
  by the freeze check + the same unique index / stale-write patterns
  already handled; worst case a rejected insert surfaces as
  `VALIDATION_FAILED`.
- **Filter removal fallout:** anything importing
  `TasksVisibilityFilter`'s old members or `shouldShowTask` breaks at
  typecheck — the compiler finds them all.
- **Expenses page** mounts `ProjectTasksProvider` without the card —
  unaffected except its seeded tasks now carry `archived` and
  `assigneeIds`.

## Calls I made (builder's discretion, flag if wrong)

- Freeze scope: all task/assignment mutations rejected while archived
  except `unarchiveTask` and `deleteTask`; Edit hidden, row read-only
  in the Archived view.
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
- Freeze error code: `FORBIDDEN` for frozen mutations (builder may
  prefer `VALIDATION_FAILED` to match existing task-domain catches).
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
