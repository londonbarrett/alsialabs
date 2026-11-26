# Assignment performance comment — Design

## Intent and why

Managers need to record a short assessment of how a collaborator performed an
assignment, next to the cost they correct after the fact. The database column
`task_assignment.comment` already exists and is already exposed through
`TaskAssignmentSchema` and `MyAssignmentSchema`, but no surface renders it.

At the same time, assignment cost auto-saves after a 300 ms debounce. That
write happens behind the user's back, so it is impossible to deliberately pair
a cost correction with a note about the work in one commit. We want both fields
to be staged in the row, committed together by one explicit Save, with clear
in-flight feedback, and shown read-only to the collaborator who did the work.

## Goals

- Give owners/admins a labeled "Comment" input inside the cost cell of every
  assignment row: the Tasks table (open and closed), the Expenses table, and
  the task history panel. No new table column or header is added.
- Stage both fields: no write until Save is clicked. Save appears as soon as
  either field differs from the stored value, and disappears after a successful
  save.
- Persist both fields in one server write. While it runs, the row's Save button
  shows a spinner and the global app loading bar is active.
- Show the comment inline under the task name in My Tasks, read-only, in both
  active and past views.
- Keep both fields read-only for collaborators everywhere; their surface for
  reading the note is My Tasks.
- Remove the debounced auto-save of assignment cost from this path.

## Non-goals and anti-goals

- No threaded discussion, edit history, or notifications. The comment is one
  nullable note that is overwritten on every save.
- No new permission code, role, or project-access concept.
- No change to task default cost, to the task's `totalCost` semantics, or to
  the separate `task_comment` discussion whose count fills My Tasks' existing
  "Comments" column. The performance note is a different thing.
- No comment editing in My Tasks, and no Save affordance for collaborators.
- No save on blur, on debounce, or on navigation away.
- No cancel/discard button; a manager reverts a draft by editing it back.

## Constraints and existing patterns

- `task_assignment.comment` is `text()` nullable with no length limit;
  `cost` is `decimal(12, 2)`, not null, default `"0"` (`lib/drizzle/schema.ts`).
- `TaskAssignmentSchema` and `MyAssignmentSchema` already carry `comment`, and
  the assignment detail/latest SQL views already select it. No migration and
  no read-path schema work are needed — only a new combined write.
- `canManageWork(role)` is exactly owner-or-admin (`lib/util/project-roles.ts`)
  and already guards cost edits. `canChangeAnyAssignment` is the equivalent
  owner-or-admin guard already used for comments. One of these guards the
  combined action; no new helper.
- `actions/tasks/actions.ts` has `updateAssignmentCost` (guarded by
  `canManageWork`) and `updateAssignmentComment` (`canChangeAnyAssignment`,
  `z.string().max(2000)`, trimmed, empty → `null`). In
  `stores/project-tasks/use-project-tasks-actions.ts`, `updateAssignmentCost`
  pends a `setAssignmentCost` with a `costDelta` and commits the server row;
  `updateAssignmentComment` pends an `upsertAssignment`. From UI components,
  only `assignment-cost-input.tsx` uses `updateAssignmentCost`; no component
  calls `updateAssignmentComment`.
- `useOptimisticAction.run()` already starts/stops `useLoadingIndicator()`
  around every mutation, so the global bar is automatic when the new save goes
  through the store hook. The per-button spinner is local component state.
- `components/ui/spinner.tsx` already wraps `Loader2Icon` with
  `role="status"`; `common.saveChanges`, `common.cost`, and
  `projects.tasks.comments.commentUpdated` already exist in both locales.
- `TaskOpenAssignmentRows` and `TaskClosedAssignmentRows` render one
  `AssignmentDetailsCells` cell: cost `MoneyInput`, a visible Comment label
  above a single-line comment `Input`, and an icon-only Save button for
  owner/admin; plain `Money` and read-only note text otherwise. No column is
  added, so `assignmentColumnCount` in `assignment-columns.ts` keeps its
  existing counts and filler cells line up. `TaskClosedAssignmentRows` is shared
  by three hosts with different headers and counts: the Tasks table, the
  Expenses table (`cellOrder="expenses"`, headers Description / Type / Amount /
  Date), and the task history panel (count forwarded by its host).
- My Tasks (`components/my-tasks/my-tasks-list.tsx`) puts the task name in the
  first cell and `Money` in the cost cell. Its "Comments" column is the
  `task_comment` count, not the performance note.

## Decisions

### Server action and queries

- Add one safe action `updateAssignment(projectId, taskId, assignmentId, cost,
  comment)` to `actions/tasks/actions.ts`, guarded by `canManageWork`, with
  `TaskAssignmentSchema` as output. It calls one leaf query in `queries.ts` that
  writes both columns together, then returns the updated view row.
- Input normalization follows today's rules: empty cost becomes `"0"`; comment
  is capped at 2000 characters, trimmed, and stored as `null` when empty.
- Retire the single-field actions and store mutations once the UI no longer
  calls them, after confirming by search that no callers remain. Prefer not to
  leave unused operations behind.

### Optimistic save

- Route the combined save through `useProjectTasksActions` and `run()`, pending
  an upsert of the assignment with both new values plus the same `costDelta`
  used by `updateAssignmentCost` (closed rows only). Commit with the returned
  server row and a zero delta; discard on failure.
- The global loading bar needs no extra wiring — `run()` owns it.
- The row component holds a local `saving` boolean for the button spinner and
  disables the button while the request is in flight.
- The store mutation returns its `SettleResult` so the row component knows
  whether the save succeeded; `settle` reports the error on failure. The draft
  and Save button stay visible on failure so nothing typed is lost.
- Drafts adopt a new prop value with the `value`/`lastValue` pattern from
  `assignment-cost-input.tsx`, but **only while the draft is clean and no save
  is in flight**. `run()` pends optimistically, so the row first re-renders
  with the typed values; on failure the store discards back to the stored
  values. Unconditional adoption would copy those reverted values into the
  drafts and silently erase the manager's text. While dirty or in flight, the
  draft ignores prop changes; on success the component clears its dirty
  baseline once the result returns, so later reseeds adopt normally. A genuine
  external reseed during a dirty draft is overridden by the draft — the
  manager can revert by hand.

### Assignment rows (manager surface)

- Replace `AssignmentCostInput` with one component owning the cost
  `MoneyInput`, a visible "Comment" label above a single-line comment `Input`,
  and the Save button — all inside the existing cost cell. No Performance
  comment column or header is added; each host's header set and forwarded
  column count stay unchanged so headers and filler cells still line up with
  the rows.
- Owner/admin see both inputs editable. Other roles see read-only cost and
  read-only note text in that cell.
- The Save button renders only when either draft differs from the stored
  values. It is icon-only, takes its accessible name from `common.saveChanges`
  through `aria-label`, and lives in the row, not as a global action.
- During the request the icon swaps to `Spinner` and the button cannot be
  clicked again; on success the drafts become the new baseline and the button
  disappears.
- Remove `useDebounced` and `COST_DEBOUNCE_MS` from this path.

### My Tasks (collaborator surface)

- Render `assignment.comment` as a plain read-only line under the task name in
  the first cell, only when non-empty. No new column, no button, no editing
  affordance, in both active and past views.
- Cost remains the existing read-only `Money` value.

### Translations and tests

- Add one new label pair `projects.tasks.comment` ("Comment" / "Comentario")
  to `messages/en.json` and `messages/es.json` with identical structure. Reuse
  `common.saveChanges` and existing comment labels. Do not touch dynamic key
  maps.
- Vitest beside the action/query: both fields are written together; comment is
  trimmed and empty becomes `null`; empty cost becomes `"0"`; a collaborator is
  rejected; the output DTO reflects the row. Store test covers pend/commit/
  discard of the combined edit including `costDelta`.
- Playwright: manager edits cost and comment, sees Save appear, clicks it,
  sees the spinner and global bar, then confirms the button is gone and both
  values survive a reload; collaborator sees the inline note in My Tasks and
  no editable inputs.

## Left to the builder (sensible defaults; call them out when implementing)

- The note is a single-line input with a visible "Comment" label inside the
  cost cell; cap it at 2000 characters to match the existing comment action.
- The cost cell keeps its existing width and header; the input fits inside it,
  following the surrounding table conventions.
- Closed (`done`/`cancelled`) rows are editable by owner/admin on every host,
  including the history panel — the existing actions never filtered by status.
- Success toast wording: reuse `projects.tasks.comments.commentUpdated` unless
  a combined "assignment updated" label reads clearly better.
- Whether deleting the retired single-field actions also removes their
  existing unit tests; prefer keeping coverage on the combined action.
