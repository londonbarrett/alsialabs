# Task Costs in Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore read-only task rows with editable closed-assignment costs to the expenses tab, and make closed-assignment cost the single SQL-backed cost model across tasks, expenses, and project cards.

**Architecture:** One shared module owns the closed-assignment cost semantics: a SQL expression for all server sums, a delta helper for optimistic edits. Server queries keep summing in SQL; the client only adjusts a server total by one pending delta. The expenses view consumes the already-mounted task store, renders task rows from it, and reuses the tasks tab's closed-assignment rows and history panel with an expenses-specific column count.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM + PostgreSQL, Zustand optimistic stores, next-safe-action, Vitest, Playwright, Tailwind v4 + shadcn/ui, next-intl. pnpm.

**Spec:** `docs/superpowers/specs/2026-11-25-task-costs-in-expenses-design.md`

## Global Constraints

- Closed means exactly `done` or `cancelled`; open assignments never contribute to a cost total.
- All committed cost sums happen in SQL through one shared `closedCostSql` expression; no TypeScript function sums a set of committed assignment costs.
- `COST_DEBOUNCE_MS = 1000` stays in `lib/tasks/cost.ts`; `sumCosts` is removed once all callers migrate.
- Tasks-table assignment layout is 7/8 columns; expenses-table layout is 4/5 columns depending on `canEdit || canDelete`.
- Repeating-task history uses 10-row pages, the stale-response guard, and the existing `TaskHistoryPanel`.
- Cost editing remains owner/admin only; the expenses tab has no task or assignment actions other than cost.
- Every task appears in expenses, including zero-cost and archived tasks; only closed assignments appear when expanded.
- `messages/en.json` and `messages/es.json` stay structurally identical; reuse `common.task`, `common.cost`, `common.loadMore`, `projects.tasks.*`.
- One component per file; memoize handlers of two lines or more with `useCallback`; no `any`, no raw colors or manual `dark:` overrides.
- E2E tests import `test`/`expect` from `./fixtures` and use `signInAs("<role>")`.
- Do not commit or push without explicit user permission (AGENTS.md). Leave all changes staged or unstaged for review.
- Run `pnpm verify` and `pnpm test:e2e` before declaring the work complete.

## Review Focus

- A task with only open assignments must show `$0` as its total in both tabs; closing one assignment must add its cost without a reload — pinned by Task 1 `closedCostDelta` tests, Task 3 status-transition tests, and Task 5 E2E.
- A zero-cost task must still render a row in expenses and contribute nothing to the footer/budget — pinned by Task 5 E2E.
- Recurring tasks must show only closed assignments, with Load more revealing older closed rows whose costs are editable — pinned by Task 5 E2E using the reused `TaskHistoryPanel`.
- Decimal costs must survive SQL aggregation without integer rounding (`12.50 + 7.25 = 19.75`, closed rows only) — pinned by Task 2 `actions/tasks/tasks.test.ts`.
- The existing expense amount cell at `getByRole("cell").nth(2)` must remain the amount despite a new task row variant — pinned by Task 5 running `e2e/decimal-money.spec.ts`.

---

### Task 1: Shared closed-cost calculation module

**Files:**
- Create: `lib/costs/total.ts`
- Create: `lib/costs/total.test.ts`
- Modify: `lib/util/project-roles.ts` (`isTerminalStatus`)

**Interfaces:**
- Consumes: `TaskStatus` from `@/lib/drizzle/schema`; `sql`/`SQL` from `drizzle-orm`.
- Produces:
  - `CLOSED_TASK_STATUSES: readonly TaskStatus[]` (`["done", "cancelled"]`)
  - `closedCostSql(costColumn: SQL, statusColumn: SQL): SQL<string>` — `coalesce(sum(case when status in (...) then cost else 0 end), 0)::text`, built with `sql.join` over `CLOSED_TASK_STATUSES`
  - `closedCostDelta(previous: { cost: string; terminal: boolean } | null, next: { cost: string; terminal: boolean } | null): number`
  - `sumMoney(values: (number | string | null | undefined)[]): number`

- [ ] **Step 1: Write the failing test** in `lib/costs/total.test.ts`

Assertions:
- `closedCostDelta({ cost: "100", terminal: false }, { cost: "150", terminal: false })` is `0`
- `closedCostDelta({ cost: "100", terminal: true }, { cost: "150", terminal: true })` is `50`
- `closedCostDelta({ cost: "100", terminal: false }, { cost: "100", terminal: true })` is `100`
- `closedCostDelta({ cost: "100", terminal: true }, { cost: "100", terminal: false })` is `-100`
- `sumMoney(["10.75", 5, null, undefined])` is `15.75`
- `closedCostSql(sql\`cost\`, sql\`status\`).queryChunks` stringified contains `case when`, `"done"`, `"cancelled"`, and `sum(`

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run lib/costs/total.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/costs/total.ts` with the four exports above**

Use `CLOSED_TASK_STATUSES` as the single status source: `closedCostDelta` checks `terminal` directly; `isTerminalStatus` in `lib/util/project-roles.ts` is changed to consult the same constant. Do not export an all-status sum.

- [ ] **Step 4: Run the test and typecheck**

Run: `pnpm vitest run lib/costs/total.test.ts && pnpm typecheck`
Expected: PASS.

### Task 2: SQL-backed totals for tasks and project cards

**Files:**
- Modify: `actions/tasks/queries.ts` (`getCostTotalsByTaskIds`, `getCostTotalByTaskId`, comments)
- Modify: `actions/projects/queries.ts` (new project aggregate, `Promise.all`, `expenses` assembly)
- Modify: `actions/tasks/tasks.test.ts`
- Modify: `actions/projects/projects.test.ts`

**Interfaces:**
- Consumes: `closedCostSql`, `sumMoney` from Task 1.
- Produces: `getTasks` DTO `totalCost` as a closed-only SQL sum; `getProjectsWithDetails` card `expenses` as expense + paid invoice + closed task cost.

- [ ] **Step 1: Write the failing tests**

In `actions/tasks/tasks.test.ts`, replace the two cost tests:
- `"sums only closed assignment costs into totalCost"`: rows `"50"/todo`, `"70"/done`, `"30"/cancelled`; mock still branches on `sql.includes("sum(")`; expect `totalCost` to be `100` and the captured cost SQL to contain `status` and `case when` (remove the old `not.toContain("status")` assertion).
- `"sums decimal closed assignment costs into totalCost without rounding"`: rows `"12.50"/todo`, `"7.25"/done`; keep the `::int` mock branch; expect `7.25`, because only the done row counts.

In `actions/projects/projects.test.ts`, replace the spend assertion in the summary test:
- `state.mock.onSelect(schema.taskAssignmentsTable)` returns `{ projectId: PROJECT.id, total: "25" }` for the `sum(` branch; expect `result.data?.[0]?.expenses` to be `105`; assert the captured task-assignment SQL contains `case when`; delete the old `taskSqls.some(sql => sql.includes("cost")) === false` assertion.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts actions/projects/projects.test.ts`
Expected: FAIL on the changed totals.

- [ ] **Step 3: Update the queries**

In `actions/tasks/queries.ts`, use `closedCostSql(taskAssignmentsTable.cost, taskAssignmentsTable.status)` in both cost queries and rewrite their comments to say the sum covers only `done`/`cancelled` rows. In `actions/projects/queries.ts`, add `getProjectClosedTaskCostTotals(projectIds)` selecting `tasksTable.projectId` plus `closedCostSql(...)` from a join of `taskAssignmentsTable` to `tasksTable`, grouped by project; add it to the `Promise.all` at line 231 and build `expenses` with `sumMoney([expenseTotal, invoicePaidTotal, taskCostTotal])`.

- [ ] **Step 4: Run tests, typecheck, and lint**

Run: `pnpm vitest run actions/tasks/tasks.test.ts actions/projects/projects.test.ts && pnpm typecheck && pnpm eslint actions/tasks/queries.ts actions/projects/queries.ts`
Expected: PASS.

### Task 3: Optimistic deltas follow the closed-only rule

**Files:**
- Modify: `components/projects/tasks/assignment-cost-input.tsx`
- Modify: `components/projects/tasks/task-open-assignment-rows.tsx`
- Modify: `components/projects/tasks/task-closed-assignment-rows.tsx`
- Modify: `stores/project-tasks/use-project-tasks-actions.ts`
- Modify: `components/projects/tasks/tasks-card.tsx`
- Modify: `lib/tasks/cost.ts` (remove `sumCosts`)
- Modify: `stores/project-tasks/use-project-tasks-actions.test.ts`
- Modify: `actions/tasks/tasks.test.ts` (drop the `sumCosts` import)

**Interfaces:**
- Consumes: `closedCostDelta`, `sumMoney` from Task 1.
- Produces: `AssignmentCostInput` gains `terminal: boolean`; `updateAssignmentCost(projectId, taskId, assignmentId, cost, previousCost?: string, terminal?: boolean)` with `terminal` defaulting to `true`; status transitions and archive/unarchive carry closed-only `costDelta`.

- [ ] **Step 1: Write the failing tests**

In `stores/project-tasks/use-project-tasks-actions.test.ts`, parameterize the mocked store with a `tasks` array in `mocks` and add:
- `"an open assignment cost edit does not move totalCost"`: store task has one open assignment with cost `"100"`; call `updateAssignmentCost(..., "150", "100", false)`; expect the pend action to contain `costDelta: 0`.
- `"closing an assignment adds its cost and reopening subtracts it"`: call `updateAssignmentStatus("project-1", "task-1", "a-1", "done")` with a store assignment `{ status: "todo", cost: "100" }`; expect pend `upsertAssignment` to have `costDelta: 100`; repeat with `"todo"` from `"done"` and expect `-100`.
- `"unarchive does not add spawned open-row cost"`: expect the unarchive commit override to have `costDelta: 0`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run stores/project-tasks/use-project-tasks-actions.test.ts`
Expected: FAIL on the new delta assertions.

- [ ] **Step 3: Update the client paths**

Pass `terminal={isTerminalStatus(assignment.status)}` into `AssignmentCostInput` from both assignment row components and forward it as the last argument of `updateAssignmentCost`. In `use-project-tasks-actions.ts`, compute the cost delta with `closedCostDelta`, compute the status-transition delta the same way, set unarchive's commit `costDelta: 0`, and set archive's pend `costDelta` to `sumMoney` of each open assignment's close delta. In `tasks-card.tsx`, use `totalCost: editing?.totalCost ?? 0` instead of `sumCosts(assignments)`. Remove `sumCosts` from `lib/tasks/cost.ts` and its remaining imports.

- [ ] **Step 4: Run tests, typecheck, and lint**

Run: `pnpm vitest run stores/project-tasks/use-project-tasks-actions.test.ts stores/project-tasks/project-tasks-store.test.ts actions/tasks/tasks.test.ts && pnpm typecheck && pnpm eslint stores/project-tasks components/projects/tasks lib/tasks`
Expected: PASS; the existing store tests still pass because the reducer's delta application is unchanged.

### Task 4: Expenses-specific column count for shared assignment rows

**Files:**
- Modify: `components/projects/tasks/task-closed-assignment-rows.tsx`
- Modify: `components/projects/tasks/task-history-panel.tsx`

**Interfaces:**
- Consumes: `assignmentColumnCount` from `assignment-columns.ts`.
- Produces: optional `columnCount?: number` prop on both components; when omitted, behavior is exactly today's 7/8.

- [ ] **Step 1: Add the optional prop and thread it through**

In `TaskClosedAssignmentRowsProps` and `TaskHistoryPanelProps`, add `columnCount?: number`. In each component, compute `const columns = columnCount ?? assignmentColumnCount(canMutate)` and use it for filler cells; in `TaskHistoryPanel`, pass it to its internal `TaskClosedAssignmentRows` and use it for the Load more `colSpan`.

- [ ] **Step 2: Verify the tasks tab is unchanged**

Run: `pnpm typecheck && pnpm eslint components/projects/tasks/task-closed-assignment-rows.tsx components/projects/tasks/task-history-panel.tsx`
Expected: PASS; no rendering change when `columnCount` is omitted. E2E coverage of the tasks tab follows in Task 5.

### Task 5: Expenses tab task rows, expanded closed assignments, and totals

**Files:**
- Modify: `components/projects/expenses/expenses-table.tsx`
- Modify: `components/projects/expenses/project-expenses.tsx`
- Modify: `e2e/task-costs.spec.ts`
- Create: `e2e/expense-task-costs.spec.ts`

**Interfaces:**
- Consumes: `useProjectTasksState()` (`tasks`), `TaskClosedAssignmentRows` and `TaskHistoryPanel` (`columnCount`), `closedCostDelta`/`sumMoney`, `isTerminalStatus`, `sortAssignments`, `formatAssignmentDueDate`.
- Produces: `CombinedExpenseRow` gains a `task` variant; expenses `total` includes task totals.

- [ ] **Step 1: Write the failing E2E tests**

In `e2e/task-costs.spec.ts`, change the two-open-assignee expectation at line 119 from `$150` to `$0`, and after the collaborator is set to `done` at line 142 assert the owner's task row total is `$75`.

Create `e2e/expense-task-costs.spec.ts` using `signInAs("user1")` and the same project URL as `task-costs.spec.ts`:
- `"task rows in expenses are read-only and count only closed assignments"`: create a task with one assignee and base cost `100`, set its assignment to `done` on the tasks tab, open `/gastos`, assert the task row is visible with `$100` in the amount cell and has no action-menu button; expand it, assert one assignment line with a `Costo` textbox and a status badge but no `combobox`; edit the cost to `150`, assert the row amount and the footer total both update to `$150`; reload and assert `$150` persists.
- `"zero-cost tasks still appear in expenses"`: create a task with base cost empty/`0`, assert its row exists in `/gastos` with `$0`.
- `"a repeating task's closed history is paginated in expenses"`: on a repeating task whose history is visible on the tasks tab, assert the `/gastos` expanded area renders the same `Cargar más` button and that fetched closed rows expose a `Costo` textbox.

- [ ] **Step 2: Run the new E2E tests to verify they fail**

Run: `pnpm test:e2e e2e/expense-task-costs.spec.ts e2e/task-costs.spec.ts`
Expected: FAIL — task rows do not exist yet.

- [ ] **Step 3: Render task rows in the expenses table**

Extend `CombinedExpenseRow` with `{ key: string; type: "task"; task: TaskWithAssignmentsDTO; date: string }`. Add a local `formatDate(date: Date)` helper (the pre-removal implementation, `YYYY-MM-DD`). In `project-expenses.tsx`, read `tasks` from `useProjectTasksState()`, spread them into `rows` with key `` `task-${task.id}` `` and date `task.createdAt ? formatDate(new Date(task.createdAt)) : "9999-12-31"`, keep the ascending date sort, and include tasks in `hasItems`. In `expenses-table.tsx`, render the task row with `ListTodo` + name, a blue `common.task` badge, `<Money value={task.totalCost} />`, the date, and an empty actions cell when the header shows Actions; never render `ActionMenu`.

- [ ] **Step 4: Render the expandable closed assignment area**

Keep expansion state as `useState<Set<string>>` in `ExpensesTable`, mirroring `TasksTable`, with a ghost `ChevronRight` toggle (`aria-label` `projects.tasks.assignmentsToggle`, `aria-expanded`, `rotate-90`). When expanded, render `sortAssignments(task.assignments.filter(isTerminalStatus))` through `TaskClosedAssignmentRows` with no `onReopen`, and for `task.recurrence !== null` render `TaskHistoryPanel` with `openIds: []`, `storeTerminal`, and `historySignature` derived from terminal assignments. Pass `columnCount = canEdit || canDelete ? 5 : 4` to both.

- [ ] **Step 5: Include task totals in the expenses total**

In `project-expenses.tsx`, build `total` with `sumMoney([...expenseAmounts, ...invoicePaidAmounts, ...tasks.map(t => t.totalCost)])`; keep the budget label, progress, over-budget flag, and footer on that `total`.

- [ ] **Step 6: Run the E2E tests and the regression spec**

Run: `pnpm test:e2e e2e/expense-task-costs.spec.ts e2e/task-costs.spec.ts e2e/decimal-money.spec.ts`
Expected: PASS; the `nth(2)` amount assertion in `decimal-money.spec.ts` still passes.

### Final verification

- [ ] Run `pnpm verify` — typecheck, lint with zero warnings, tests with coverage thresholds.
- [ ] Run full `pnpm test:e2e`.
- [ ] Open `/app/proyectos/<id>/gastos` in Chrome with `browse` and check task rows, expansion, cost editing, totals, and column alignment visually.
- [ ] Do not commit; present the diff for review.
