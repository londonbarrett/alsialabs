# Assignment performance comment — Design (as built)

## Intent and why

Managers need to record a short assessment of how a collaborator performed an
assignment, next to the cost they correct after the fact. The database column
`task_assignment.comment` already existed and was exposed through
`TaskAssignmentSchema` and `MyAssignmentSchema`, but no surface rendered it.

Assignment cost previously auto-saved after a 300 ms debounce, writing behind
the user's back and making it impossible to pair a cost correction with a note
in one deliberate action. Both fields are now staged in the row and committed
together by one explicit Save, with a button spinner and the global loading bar
as in-flight feedback. Collaborators read the note read-only in My Tasks.

## Goals

- Give owners/admins a cost input and a comment input in every assignment row:
  the Tasks table (open and closed), the Expenses table, and the task history
  panel.
- Stage both fields: no write until Save is clicked. Save is present but
  disabled until either field differs from the stored value; it re-disables
  after a successful save.
- Persist both fields in one server write. While it runs, the Save button shows
  a spinner and the global app loading bar is active.
- Show the comment read-only in its own **Comment** column in My Tasks, in both
  active and past views.
- Keep both fields read-only for collaborators everywhere; My Tasks is their
  surface for reading the note.
- Remove the debounced auto-save of assignment cost from this path.

## Non-goals and anti-goals

- No threaded discussion, edit history, or notifications. The comment is one
  nullable note that is overwritten on every save.
- No new permission code, role, or project-access concept.
- No change to task default cost or to the task's `totalCost` semantics.
- No change to the separate `task_comment` discussion whose count fills My
  Tasks' existing "Comments" column; the performance note is a different thing.
- No comment editing in My Tasks and no Save affordance for collaborators.
- No save on blur, debounce, or navigation away; no cancel/discard button.

## Constraints and existing patterns

- `task_assignment.comment` is nullable `text()`; `cost` is
  `decimal(12, 2)`, not null, default `"0"`. No migration was needed.
- `canManageWork(role)` is owner-or-admin (`lib/util/project-roles.ts`) and
  guards the combined action; no new permission code.
- The combined write goes through `actions/tasks/` (safe action in `actions.ts`,
  leaf query in `queries.ts`, DTOs in `schemas.ts`, barrel in `index.ts`).
- `useOptimisticAction.run()` drives the global loading bar; the form hook uses
  react-hook-form with `isDirty`/`isSubmitting` for the Save button state.
- One component per file; shadcn/Tailwind tokens only; translations stay
  structurally identical in `messages/en.json` and `messages/es.json`.

## Decisions

### Server action and queries

- One safe action `updateAssignment(projectId, taskId, assignmentId, cost,
  comment)`, guarded by `canManageWork`, writes both columns in one leaf query
  and returns `TaskAssignmentSchema`.
- Input normalization: empty cost → `"0"`; comment trimmed, capped at 2000,
  empty → `null`.
- The old single-field actions/store mutations were retired; no unused
  operation is left behind except the validation-only `UpdateAssignmentCostSchema`.

### Optimistic save and draft

- The store mutation pends `setAssignmentDetails` with both fields and the
  closed-only `costDelta`, commits the server row with a zero delta, discards on
  failure, and returns `SettleResult`. It never inserts a row for fetched
  history, so the history panel stays authoritative.
- The colocated `useAssignmentDetailsForm` hook owns the draft. It adopts new
  props only while clean and idle, preserving typed text across failed saves.
  An "accepted baseline" ref keeps saved values visible until props actually
  advance, which also covers fetched history rows whose props never change.

### Assignment rows (manager surface)

- `AssignmentDetailsCells` renders two cells: cost (`MoneyInput`/`Money`) and
  comment. On Tasks the comment cell uses `colSpan={3}` (the three columns left
  after cost) and carries `px-10` horizontal padding; on Expenses it stays one
  column. The comment input grows to fill the cell and uses the **Comments**
  placeholder (`common.comments`) with no visible label.
- Save is a labelled button (`Save` icon + `common.save`, "Guardar"/"Save"),
  always rendered but disabled until a field changes or while saving. Its icon
  becomes a `Spinner` during the write; `aria-busy` on the global bar remains
  the other in-flight signal.
- Closed rows are editable by owner/admin on every host, including history.
- Debouncing was removed from this path.

### Table layout (Tasks tab)

- Task row: **name → status → due date → total cost → priority → assignees →
  actions**, with the recurring badge inline next to the title.
- Assignment row: **assignee → status → due date → cost → comment (3 columns) →
  actions**, with date-only due values (`formatAssignmentDueDate`) on both rows.
- Header order, widths, filler cells and `colSpan` are kept in sync across the
  Tasks and Expenses hosts and the history panel.

### My Tasks (collaborator surface)

- A dedicated **Comment** column sits after Cost, showing `assignment.comment`
  read-only when present. The separate task-discussion "Comments" count column
  is unchanged.

### Translations and tests

- No new translation key was needed for the final UI: `common.comments`,
  `common.save`, `common.cost`, and `projects.tasks.comment` already exist.
- Vitest covers the combined action, store mutation, form hook (including the
  failed-save guard and fetched-row value adoption), and My Tasks markup.
- Playwright covers the staged save, spinner/global bar, reload persistence,
  collaborator read-only view, and the table-layout invariants.

## Left to the builder (sensible defaults; call them out when implementing)

- Closed (`done`/`cancelled`) rows stay editable by owner/admin; existing
  actions never filtered by status.
- Success toast wording reuses `projects.tasks.comments.commentUpdated`.
- Comment input is capped at 2000 characters; no rich text or history.
