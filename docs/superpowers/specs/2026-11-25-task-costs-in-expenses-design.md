# Task Costs in Expenses — Design

## Intent and why

The expenses tab used to show task costs as rows. They were removed when tasks
moved to multiple assignees (commit `a3b7060`) because the old single
`task.cost` number no longer reflected what the work actually cost. With
per-assignment costs and a server-aggregated task `totalCost` now in place, we
can restore that view honestly: a manager should see what work costs alongside
receipts and paid invoices, and correct a per-assignment amount right where
they see it.

## Goals

- Show **every** project task as a row in the expenses table, including
  zero-cost tasks and archived tasks (the page already loads all of them).
- The task row is display only: name, a Task badge, the task's `totalCost`, and
  a date. No edit, no delete, no task dialog, no `ActionMenu`.
- The task row is expandable; the expanded area shows only that task's
  **closed** (`done` / `cancelled`) assignments — never open ones.
- Closed assignment lines look like the tasks-table closed rows (assignee,
  occurrence, status badge, cost) but **cost is the only editable thing**. No
  status select and no Reopen. For repeating tasks, the paginated closed
  history — including the "Load more" button — works like the tasks tab.
- Task totals, on both the tasks and expenses tabs, count only closed
  assignments; open assignments never contribute to a total.
- Owners/admins edit an assignment's cost with the existing
  `AssignmentCostInput`. Collaborators see a read-only `Money` value — and in
  practice cannot reach this tab at all.
- A cost edit writes through the existing `updateAssignmentCost` action and
  optimistic task store, so the task row's total and the expenses footer /
  budget bar move immediately.
- Expenses total becomes `expenses.amount + paid invoices + task totalCost`.
- Project cards use the same model: their spend figure includes closed
  assignment costs alongside expenses and paid invoices.
- All committed cost totals are summed in **SQL**, through one shared SQL
  expression. The client only applies the same closed-assignment semantics as
  optimistic deltas, so no optimistic behavior is lost.
- Reuse existing components, stores, actions, and translations. No new DB
  columns or safe actions; the existing cost-sum queries are updated to use
  the shared SQL expression.

## Non-goals and anti-goals

- No task edit, delete, archive, status, priority, or comment action from this
  screen. The task row must not open `TaskDialog`.
- No new cost field on the task and no change to how a task's default cost is
  applied to new assignments.
- No invoice creation or binding from a task row.
- No status changes or reopening assignments from this screen. "Load more"
  brings historical closed rows into view; it does not add task-tab controls.
- No open assignments in the expenses tab. A task with no closed assignments
  still gets a read-only row with a zero total, but expands to nothing.
- No permission widening. Cost editing stays owner/admin, matching the
  `canManageWork` guard on the server action.
- Do not sum a partially loaded assignment list for display or totals. Always
  use the server-computed `task.totalCost`.

## Constraints and existing patterns

- `app/app/proyectos/[id]/gastos/page.tsx` already fetches `getTasks()` and
  mounts `ProjectTasksProvider`. `ProjectExpenses` simply does not consume
  `useProjectTasksState()` today — no new fetching is needed.
- `components/projects/expenses/expenses-table.tsx` has a `CombinedExpenseRow`
  union with `expense` and `invoice` variants. Its header has 4 columns, plus a
  fifth Actions column when `canEdit || canDelete`. Task rows have no Actions
  cell, so filler cells must keep header/body alignment intact.
- `AssignmentCostInput` (`components/projects/tasks/assignment-cost-input.tsx`)
  already owns local state, the 1 s debounce (`COST_DEBOUNCE_MS`), the
  `updateAssignmentCost` call, and resync on a new server value. Reuse it
  directly rather than reimplementing persistence.
- `TaskHistoryPanel` (`components/projects/tasks/task-history-panel.tsx`)
  already owns history pagination: 10-row pages, the stale-response guard,
  zero-open scope, and open→terminal absorption. Reuse it rather than
  reimplementing any of that logic.
- The shared assignment row components and `TaskHistoryPanel` derive their
  filler cells and the Load more `colSpan` from `assignmentColumnCount(canMutate)`,
  which returns 7/8 for the tasks table. The expenses table has 4/5 columns,
  so that count must become an explicit prop threaded from the expenses view
  before these components can be reused here.
- `useProjectTasksActions().updateAssignmentCost` dispatches an optimistic
  `setAssignmentCost` with a `costDelta` and replaces the temp row with the
  server DTO on commit. The same action serves both tabs; only the reducer's
  delta rule needs to change (see Total cost semantics).
- `TaskWithAssignmentsDTO` (`actions/tasks/schemas.ts`) carries `totalCost:
  number`, which this design redefines as the server sum over **terminal**
  assignment rows only, plus `assignments: TaskAssignmentDTO[]`. For
  non-recurring tasks that array is the full loaded set; for recurring tasks it
  is the slim set (open rows plus the latest per assignee), with older closed
  rows behind Load more.
- `useProjectTasksActions().updateAssignmentStatus` already tracks
  open↔terminal transitions for `closedCount`. The same transitions must move
  `totalCost` by that assignment's cost once totals become terminal-only.
- `lib/tasks/cost.ts` already holds `costToNumber`, `sumCosts`, and
  `COST_DEBOUNCE_MS`. Keep `COST_DEBOUNCE_MS` there; move the sum semantics into
  one shared module that owns both the SQL sum expression and the small client
  delta helper, so the two cannot drift.
- Reuse `sortAssignments`, `formatAssignmentDueDate`, `taskStatusColors`, the
  avatar markup, and `common.cost` / `common.task` / `projects.tasks.status.*`
  translations. `messages/en.json` and `messages/es.json` must stay
  structurally identical; prefer reuse, expect no new keys.
- Project-card spend is aggregated server-side in `actions/projects/queries.ts`
  (`getProjectExpenseTotals`, `getProjectInvoicePaidTotals`, combined at line
  331). `actions/projects/projects.test.ts` currently asserts that task costs
  *never* reach that figure; that assertion must be updated.
- `e2e/decimal-money.spec.ts` locates the amount cell by index in an expense
  row; adding row variants/cells must not break it.
- Project convention: one component per file, memoize handlers of two lines or
  more with `useCallback`, no `any`, no raw colors or manual `dark:` overrides.

## Decisions

### Row assembly (`project-expenses.tsx`)

- Read tasks from `useProjectTasksState()` and spread them into the existing
  `rows` array as `{ key: \`task-${task.id}\`, type: "task", task, date }`.
- `date` comes from the task's `createdAt`, formatted with the same date helper
  the pre-removal implementation used; tasks without a usable date sort last.
- Keep the single ascending sort by `date`. Include tasks in `hasItems`, so a
  project with only tasks still renders the table and the total.

### Task row (`expenses-table.tsx`)

- Description cell: `ListTodo` icon + task name (the pre-removal treatment).
- Type cell: blue badge using `common.task`.
- Amount cell: `<Money value={task.totalCost} />`.
- Date cell: the formatted date, same as other rows.
- Actions cell: render an empty cell when the header shows Actions, so column
  count stays aligned; never render an `ActionMenu` for a task.
- Expand toggle: ghost chevron button mirroring `TasksTable` —
  `aria-label={t("projects.tasks.assignmentsToggle")}`, `aria-expanded`,
  `rotate-90` when open. Show a spacer when the task has no assignments.
- Expansion state is local `useState<Set<string>>` in `ExpensesTable`, following
  `TasksTable`; the expenses view never mutates task state from this row.

### Expanded assignment rows

- Show **only terminal assignments** (`isTerminalStatus`: `done` or
  `cancelled`), using the existing helper. Open rows never appear in the
  expenses tab, regardless of role.
- Reuse `TaskClosedAssignmentRows` without `onReopen`: status stays a badge,
  the cost cell renders `AssignmentCostInput` for owner/admin and a read-only
  `Money` for everyone else, including rows fetched by Load more. No new
  open-row component is needed.
- Reuse `TaskHistoryPanel` for Load more, passing `openIds: []` so the zero-open
  scope renders every terminal store row from first paint; older closed pages
  still arrive through `loadAssignmentHistory` with the same stale-response
  guard and 10-row page size. Compute `storeTerminal` and `historySignature`
  from the task's terminal assignments as the tasks tab does.
- Non-recurring tasks need only the closure of `TaskClosedAssignmentRows`;
  `TaskHistoryPanel` returns `null` for them by design.
- Thread an explicit `columnCount` (4 or 5, from the expenses header) into
  `TaskClosedAssignmentRows` and `TaskHistoryPanel` so filler cells and the
  Load more `colSpan` align with this table; the tasks tab keeps 7/8.
- Every visible assignment is terminal, so every cost edit here correctly
  moves the task total; no extra guard is needed on this screen.

### Cost calculation (SQL plus optimistic mirror)

- Introduce one shared module (candidate: `lib/costs/total.ts`) that owns the
  cost semantics for every surface:
  - `CLOSED_TASK_STATUSES` — the canonical `done` / `cancelled` set, kept in
    step with `isTerminalStatus`.
  - `closedCostSql(costColumn, statusColumn)` — the **single** SQL expression
    used by every server aggregate, along the lines of
    `coalesce(sum(case when status in (...) then cost else 0 end), 0)`.
    Server-side summing always happens here; no caller writes its own
    `sum(cost)` with a different status filter.
  - `closedCostDelta(previous, next)` — the client mirror for one optimistic
    assignment change: new closed cost minus old closed cost, zero when the
    row is open on both sides. It adjusts a server total for a pending write;
    it never derives a committed total from a loaded row list.
  - `sumMoney(values)` — one place that adds already-computed money values
    (expense amounts, paid invoice amounts, task totals) for display.
- `COST_DEBOUNCE_MS` stays in `lib/tasks/cost.ts`; the old all-status `sumCosts`
  is removed so there is no second sum rule.

### Total cost semantics (both tabs)

- Update `getCostTotalsByTaskIds` / `getCostTotalByTaskId` in
  `actions/tasks/queries.ts` to use `closedCostSql` with the shared status set.
  Their comments currently say "EVERY assignment" and must change.
  `getTasksWithAssignments` keeps consuming those SQL totals for
  `TaskWithAssignmentsDTO.totalCost`.
- Update `setAssignmentCost` in `stores/project-tasks/project-tasks-reducer.ts`
  so `costDelta` comes from `closedCostDelta` on the old and new row — zero
  for an open assignment. Editing an open assignment's cost changes the stored
  `cost` but not `totalCost`.
- Update `useProjectTasksActions().updateAssignmentStatus` so open→terminal
  adds and terminal→open subtracts the row's cost via the same helper; avoid
  double-applying it alongside `spawnedCostTotal` on commit.
- Update `components/projects/tasks/tasks-card.tsx` to use the shared closed
  cost rule for optimistic totals instead of `sumCosts`, so a freshly added
  task never briefly shows an open-assignment cost.
- This supersedes `docs/superpowers/specs/2026-11-22-task-costs-design.md`,
  which counted every status. Update affected unit tests in `actions/tasks/`
  and `stores/project-tasks/`, and any E2E assertions that used the old total.

### Project cards

- Add one server query that aggregates closed assignment costs by project in
  SQL, reusing `closedCostSql` (join `taskAssignmentsTable` to `tasksTable`,
  group by `projectId`). It is the same SQL expression as the task total, not
  a parallel formula.
- Add it to the `Promise.all` batch in `actions/projects/queries.ts` and build
  the card's `expenses` value with `sumMoney` over expense total, paid invoice
  total, and closed task cost total. No card UI change is needed.
- This supersedes the 2026-10-30 spec that removed task costs from this
  aggregate.

### Totals

- In `project-expenses.tsx`, build `total` with `sumMoney` over expense
  amounts, paid invoice amounts, and `task.totalCost` values from the
  SQL-backed task store. This adds already-aggregated values; it does not
  re-derive assignment costs in TypeScript.
- The budget label, progress percentage, over-budget flag, and footer all use
  that `total`. Because the task store is shared with this page, a cost edit in
  an expanded row re-renders the totals with no additional wiring.

### Tests

- Unit-test `closedCostDelta` and `sumMoney` directly (open rows contribute
  zero, terminal rows add their cost, money values add correctly), and add
  query-level tests for `closedCostSql` so the SQL and client rules are both
  covered.
- Update unit tests for the terminal-only total in `actions/tasks/` and
  `stores/project-tasks/`: open assignment costs excluded from `totalCost`,
  status transitions add/subtract correctly, and edits to open rows leave the
  total unchanged. Update `actions/projects/projects.test.ts` so project-card
  spend includes closed task costs instead of excluding them.
- Extend the project-expenses E2E coverage: task rows appear (including a
  zero-cost task), the toggle expands only closed assignment lines (open ones
  absent), status is a badge and not a select, no action menu exists on the
  task row, Load more reveals further closed rows on a repeating task, and an
  admin cost edit updates the task row total and the footer/budget total. Use
  `test`/`expect` from `./fixtures` and `signInAs("<role>")`.
- Verify in the browser after the UI change, and run `pnpm verify` plus
  `pnpm test:e2e` before handing off.

## What's left to the builder

- The exact shared date helper and dateless-task fallback used by the old
  implementation (check `git show a3b7060^:components/projects/expenses/project-expenses.tsx`).
- Whether to make `columnCount` an optional prop on the shared components
  (defaulting to the tasks tab's 7/8) or require it explicitly from both
  tables; either keeps the tasks tab unchanged.
- Final location and name of the shared calculation module, and the exact
  `closedCostSql` expression; the one rule is that every server cost sum uses
  it and no second sum rule remains.
- Which existing expenses E2E spec to extend, and whether a single row-level
  test or a small set is the right fit.
- Confirm no new translation key is needed; reuse `common.task` and
  `projects.tasks.*` unless a label genuinely differs here.
