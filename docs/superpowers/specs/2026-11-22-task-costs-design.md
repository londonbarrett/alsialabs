# Task Costs — Design

## Intent and why

Tasks need a cost attached to each assignment so the project can see what its
work costs. The task carries a *default* amount that makes assigning routine
work fast, while each assignment carries its own amount so a manager can
correct it later without rewriting history. Totals are read from assignments,
never from the task's default, so the displayed number always reflects what
was actually recorded.

## Goals

- Add a default-cost field to the task form's first (Details) step using the
  existing `MoneyInput`.
- Store a default cost on the task, and an actual cost on every assignment.
- Every new assignment takes its cost from the task at creation time.
- Let an owner/admin change an assignment's cost inline from the assignment
  row, as the user types, persisted after a debounce. This works at any
  assignment status.
- Show a read-only total cost in the task row, summed over **all** assignments
  of the task — including closed/cancelled rows and rows hidden behind Load
  More.
- Show each assignment's cost read-only in My Tasks, using the existing
  `Money` component.
- Reuse `MoneyInput`, `Money`, the existing safe-action conventions, the
  optimistic store, and the existing `common.cost` translation.

## Non-goals and anti-goals

- No invoice or expense integration, no currency selector, no budget-variance
  or reporting UI.
- No propagation of a task default-cost change to existing assignments. A
  change to the task's cost affects future assignments only.
- No cost editing by collaborators. They already have no access to project
  details; nothing here expands their access.
- Do not display a total derived from a partially loaded assignment list —
  that would silently undercount repeating tasks.

## Constraints and existing patterns

- `MoneyInput` (`components/common/money-input.tsx`) parses integers only:
  costs are whole currency units, no cents. `Money` formats for display and
  accepts `number | string | null`.
- Money columns elsewhere use `decimal(12, 2)` (for example
  `projectsTable.budget`). Drizzle returns decimals as strings; conversions
  for arithmetic belong in a small shared helper, not scattered in views.
- Authorization: `canManageWork(role)` in `lib/util/project-roles.ts` is
  exactly owner-or-admin, and is already the guard used by task create and
  update. Reuse it for cost edits. There is no need for a new permission code
  or a new role concept.
- Task mutations go through `actions/tasks/` (barrel `index.ts`, safe actions
  in `actions.ts`, all DB work in `queries.ts`, schemas/DTOs in `schemas.ts`).
  Adding a cost edit means adding both an action and a leaf query there.
- Task list state lives in `stores/project-tasks/`. The store may hold only a
  page of a repeating task's assignments, so a client-side sum is unsafe.
  `closedCount` already solves the analogous problem by being counted
  server-side on `TaskWithAssignmentsDTO`.
- The task form is a two-step wizard in `components/projects/task-form.tsx`;
  step 1 is `TaskFormDetailsStep`. Fields are threaded through local state
  and submitted through `TaskFormValues` → `toTaskPayload`.
- Translations live in `messages/en.json` and `messages/es.json` and must stay
  structurally identical. `common.cost` already exists in both. Check for
  existing terms before adding keys; add only genuinely new labels (for
  example a total-cost header).

## Decisions

### Data model

- `task.cost`: `decimal(12, 2)`, not null, default `"0"`. The default amount
  copied to new assignments, in whole units.
- `task_assignment.cost`: `decimal(12, 2)`, not null, default `"0"`. The
  actual amount for that assignment, independent of the task's default after
  creation.
- Generate the migration with `pnpm db:generate`; never hand-edit `drizzle/`.

### Task form, step 1

- Add a default-cost field rendered with `MoneyInput`, following the `Field` +
  `FieldLabel` pattern used by the other step-1 fields. An untouched field
  means `0`.
- Submit `cost` with the rest of the form payload for both create and edit.
  Add it to `TaskFormBaseSchema` (and therefore `CreateTaskSchema`/
  `UpdateTaskSchema`) and to `TaskFormValues`.

### Template semantics

- Changing `task.cost` on edit never writes to any existing
  `task_assignment` row.
- Any assignment created afterwards takes the task's current `task.cost`.
  This applies to every creation path: task creation, adding an assignee on
  task edit, repeating-occurrence spawning, and unarchive/reopen spawning.
- A manager may edit an individual assignment's cost at any time, regardless
  of the assignment's status. An edited assignment is never overwritten by
  later changes to the task's default.

### Inline assignment cost editing

- Render `MoneyInput` in the assignment cost cell of `TaskOpenAssignmentRows`
  and `TaskClosedAssignmentRows` for owner/admin; render a plain read-only
  `Money` value for others. Keep the existing column-count helper in sync
  when adding a column.
- Debounce with the existing `useDebounced` hook (`hooks/use-debounced.ts`);
  the conventional delay in this repo is 300 ms. Persist only after the
  debounce fires; do not add a separate save-on-blur path.
- Add `updateAssignmentCost` (projectId, taskId, assignmentId, cost) as a safe
  action guarded by `canManageWork(ctx.projectRole)`, plus a leaf query in
  `queries.ts`. Include input and output schemas; the output returns the
  updated assignment DTO.
- Route the mutation through `useProjectTasksActions` and an optimistic
  reducer case that updates just the matching assignment's cost **and**
  applies a `costDelta` to its task's `totalCost` (new cost minus old cost),
  then replaces the temp value with the server row on commit and reverts on
  discard. Report failures with `useSettle`/toast like sibling mutations.
- While the input is empty, the parsed value is `""`; normalize that to `0`
  before dispatching the action so a cleared field stores a real number.

### Total cost

- Compute `totalCost` on the server over **all** `task_assignment` rows for
  the task, with no status filter and no pagination — the sum of every
  assignment's cost, done or cancelled, visible or hidden behind Load More.
- Expose it on `TaskWithAssignmentsSchema` as a number, alongside
  `closedCount`. It is authoritative whenever the server re-seeds the store
  (initial load, navigation, or a revalidating action such as task create,
  edit, archive, unarchive, or delete).
- Between reseeds, maintain the displayed total with a local `costDelta` on
  the optimistic pend, exactly as `closedDelta` maintains `closedCount`. The
  commit re-applies neither the delta nor a fresh count, and a discard
  reverts both with the rest of the pend.
- Apply a delta on every path that can change the sum without returning a
  fresh task DTO: an inline recost (`newCost − oldCost`), a status change that
  spawns a successor assignment (`+spawned cost`), and unarchive spawning
  (`+sum of spawned costs`). Task create/update/delete already return or
  remove a whole task DTO, so they need no manual delta. Do **not** widen
  `AssignmentStatusResultSchema`, `UnarchiveTaskResultSchema`, or the new
  `updateAssignmentCost` output with a total — the delta covers the gap, and
  the next reseed makes the server value authoritative.
- Render it read-only in the task row with `Money`.

### My Tasks

- Add `cost` to `MyAssignmentSchema` and query it with the assignment rows.
- Render it read-only in `my-tasks-list.tsx` with `Money`, including in the
  read-only/past view. No editing affordance in My Tasks.

### Translations and tests

- Reuse `common.cost`; add only genuinely new labels (for example a total-cost
  header) to both locale files with identical structure.
- Cover: default-cost inheritance on every assignment creation path, that
  changing a task's default does not rewrite existing rows, inline recost
  persistence and permission guard, and the server-side total across closed
  and unpaginated rows. Use vitest beside the action/query code and Playwright
  for the form and My Tasks surfaces.

## Left to the builder (sensible defaults; call them out when implementing)

- Exact debounce delay — use 300 ms to match `useDebounced` usage elsewhere.
- Column placement in each table, and whether the cost column is hidden on
  narrow viewports — follow the surrounding table conventions.
- Whether the numeric helper lives in `lib/tasks/` or `lib/util/`; keep it
  in one place shared by query mapping and view formatting.
- `0` vs `null` at the DB level is settled above (not null, default `"0"`);
  the builder only decides how to coerce `"0"` into a number for display.
