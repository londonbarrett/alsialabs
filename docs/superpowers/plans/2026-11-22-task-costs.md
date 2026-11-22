# Task Costs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default cost to tasks, copy it onto every new assignment, allow owners/admins to recost any assignment inline, and show a server-authoritative sum of all assignment costs on the task row.

**Architecture:** The task stores a default amount; assignment rows snapshot it at creation and then own their value. The total is never stored — a SQL aggregate over all `task_assignment` rows (no status filter, no pagination) feeds `TaskWithAssignmentsDTO.totalCost`, and the optimistic store keeps it live between reseeds with small local deltas. All UI reuses `MoneyInput` (editing) and `Money` (display).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM + PostgreSQL, next-safe-action, Zustand optimistic stores, Tailwind v4 + shadcn/ui, next-intl, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-22-task-costs-design.md`

## Global Constraints

- **No commits.** `AGENTS.md` requires explicit permission before any commit or push; every task ends at verification, not a commit step.
- Package manager is **pnpm**; use `pnpm typecheck`, `pnpm eslint <paths>`, `pnpm test:run`, `pnpm vitest run -t "<name>"`, `pnpm test:e2e`.
- Generate migrations with `pnpm db:generate`. Never hand-edit `drizzle/` SQL, snapshots, or `_journal.json`.
- Do not add `any`; do not weaken lint/coverage thresholds.
- One component per file. Icons from `lucide-react`, toasts via `sonner`.
- `messages/en.json` and `messages/es.json` stay structurally identical. Reuse `common.cost`; the only new copy is a total-cost header under `projects.tasks`.
- Costs are whole currency units (`MoneyInput` parses integers). DB columns are `decimal(12, 2)` not null default `"0"`; DTOs expose them as strings.
- Owners **and** admins may change costs (`canManageWork`); collaborators cannot. No new permission code.
- A task default change never writes to an existing assignment; mode switching is out of scope.

## Review Focus

- A cleared inline cost input must persist `0`, never `""`/`NaN` — pinned by the empty-cost action test in Task 2 and the e2e recost in Task 4.
- A crafted action payload with a negative or decimal cost must be rejected by the input schema — pinned by the schema test in Task 1.
- A cost update for an assignment in another project must be forbidden, not merely missing — pinned by the action test in Task 2.
- Spawned successor assignments must take the task's **current** default, not a stale one — pinned by the inheritance test in Task 1.
- The displayed total must stay correct after a multi-assignment spawn and after unarchive — pinned by the reducer tests in Task 4.

---

### Task 1: Cost columns, DTOs, and query-layer inheritance

**Files:**
- Modify: `lib/drizzle/schema.ts` (`tasksTable`, `taskAssignmentsTable`, `taskAssignmentDetailView`, `taskAssignmentLatestView`)
- Create generated migration under `drizzle/` via `pnpm db:generate`
- Modify: `actions/tasks/schemas.ts`
- Modify: `lib/tasks/assignments.ts`
- Create: `lib/tasks/cost.ts`
- Modify: `actions/tasks/queries.ts`
- Test: `actions/tasks/tasks.test.ts`
- Test: `actions/tasks/schemas.test.ts`

**Interfaces:**
- Consumes: existing `TaskFormBaseSchema`, `TaskRecordSchema`, `TaskAssignmentSchema`, `MyAssignmentSchema`, `TaskWithAssignmentsSchema`, `AssignmentStatusResultSchema`; existing view column maps in `actions/tasks/queries.ts`.
- Produces:
  - `costToNumber(value: string): number` and `sumCosts(rows: { cost: string }[]): number` in `lib/tasks/cost.ts`.
  - DTO fields `TaskRecordDTO.cost: string`, `TaskAssignmentDTO.cost: string`, `MyAssignmentDTO.cost: string`, `TaskWithAssignmentsDTO.totalCost: number`.
  - `TaskFormBaseSchema.cost: string` (digits-only, optional, default `""`); `UpdateAssignmentCostSchema = { projectId: string; assignmentId: string; cost: string }` and `UpdateAssignmentCostDTO`.
  - `AssignmentStatusResultSchema.spawnedCostTotal: number`.
  - `queries.updateAssignmentCost(assignmentId: string, cost: string): Promise<void>`.
  - `queries.getCostTotalsByTaskIds(taskIds: string[]): Promise<{ taskId: string; total: number }[]>` and `queries.getCostTotalByTaskId(taskId: string): Promise<number>`.
  - `getTaskWithAssignments()` returns an extra `totalCost: number`.
  - Every assignment insert path passes `cost` from the task row being used at that moment.

- [ ] **Step 1: Add the schema columns and view fields**

  In `lib/drizzle/schema.ts`, add to `tasksTable` and `taskAssignmentsTable`:
  `cost: decimal("cost", { precision: 12, scale: 2 }).notNull().default("0")`.
  Add `cost: sql<string>`${taskAssignmentsTable.cost}`.as("cost")` to `taskAssignmentDetailView`, and `cost: numbered.cost` to `taskAssignmentLatestView` (including its inner `numbered` select).

- [ ] **Step 2: Generate the migration**

  Run `pnpm db:generate`. Inspect the generated SQL: both columns must be `NOT NULL DEFAULT '0'`, and the views must be recreated with the new column. Do not edit the generated files.

- [ ] **Step 3: Write the failing schema test**

  Add to `actions/tasks/schemas.test.ts`: `UpdateAssignmentCostSchema.safeParse({ projectId: <uuid>, assignmentId: <uuid>, cost: "-5" })` and `cost: "12.50"` must both fail; `cost: "120"` and `cost: ""` must succeed.

- [ ] **Step 4: Run the test to verify it fails**

  Run `pnpm vitest run actions/tasks/schemas.test.ts -t "cost"`. Expected: FAIL (schema does not exist).

- [ ] **Step 5: Add the DTO and helper definitions**

  In `actions/tasks/schemas.ts`, add the fields and schemas listed in Interfaces. In `lib/tasks/cost.ts`, implement `costToNumber` (`Number(value) || 0`) and `sumCosts` (reduce over `costToNumber`). In `lib/tasks/assignments.ts`, add `cost: string` to `AssignmentRow` and to the object returned by `toTaskAssignmentDTO`.

- [ ] **Step 6: Add the cost queries and wire inheritance**

  In `actions/tasks/queries.ts`: add `cost` to `ASSIGNMENT_VIEW_COLUMNS` and `LATEST_ASSIGNMENT_COLUMNS`; add the two aggregate leaf queries using `sql<number>` with `coalesce(sum(cost), 0)::int` and no status filter; add `updateAssignmentCost`; extend `AssignmentSpawn` inserts so `createTask` uses `values.cost || "0"`, `syncTaskAssignments` uses `taskRow.cost`, and `spawnEligibleAssignments` uses the re-read task row's `cost`. Include `getCostTotalsByTaskIds` in `getTasksWithAssignments`' `Promise.all` and `getCostTotalByTaskId` in `getTaskWithAssignments`; expose `totalCost` on both results. Add the new functions to the default-exported `queries` object.

- [ ] **Step 7: Write the failing inheritance and total tests**

  In `actions/tasks/tasks.test.ts`, using the existing `vitest-drizzle-mock` setup: (a) create a task with `cost: "120"` and assert the inserted assignment rows carry `cost: "120"`; (b) edit a task's default to `"200"` and assert a spawned assignment inserted by `spawnEligibleAssignments` carries `"200"`; (c) assert `getTasks` returns `totalCost` equal to the sum of every assignment row in the mocked select, including rows with `status: "cancelled"`.

- [ ] **Step 8: Run the tests to verify they pass**

  Run `pnpm vitest run actions/tasks/tasks.test.ts -t "cost"`, then `pnpm vitest run actions/tasks/schemas.test.ts -t "cost"`. Expected: PASS.

- [ ] **Step 9: Verify types and lint**

  Run `pnpm typecheck` and `pnpm eslint actions/tasks lib/tasks lib/drizzle/schema.ts`. Expected: no errors.

---

### Task 2: Safe action surface for recosting

**Files:**
- Modify: `actions/tasks/actions.ts`
- Test: `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `queries.updateAssignmentCost`, `queries.getAssignmentForRow`, `queries.getAssignmentViewById`, `costToNumber`, `UpdateAssignmentCostSchema`, `toTaskAssignmentDTO`, `canManageWork`.
- Produces: `updateAssignmentCost` safe action returning `TaskAssignmentDTO`; `AssignmentStatusResultDTO.spawnedCostTotal: number`; `createTask`/`updateTask` results carry `totalCost`.

- [ ] **Step 1: Write the failing action tests**

  In `actions/tasks/tasks.test.ts`: (a) owner recosts an assignment and expect the returned DTO's `cost` to be the new value; (b) collaborator recost returns `FORBIDDEN`; (c) an `assignmentId` outside the input `projectId` returns `FORBIDDEN`/`NOT_FOUND` (no update issued); (d) recosting with `cost: ""` returns and stores `"0"`; (e) `createTask` result includes `totalCost` from the loaded task.

- [ ] **Step 2: Run the tests to verify they fail**

  Run `pnpm vitest run actions/tasks/tasks.test.ts -t "recost"`. Expected: FAIL (action missing).

- [ ] **Step 3: Implement the action**

  In `actions/tasks/actions.ts`, add `updateAssignmentCost = projectAction(UpdateAssignmentCostSchema).metadata({}).outputSchema(TaskAssignmentSchema).action(...)`, with body order: `canManageWork(ctx.projectRole)` guard → `queries.getAssignmentForRow(assignmentId, projectId)` scope check → `queries.updateAssignmentCost(assignmentId, parsedInput.cost || "0")` → reload via `queries.getAssignmentViewById` → `toTaskAssignmentDTO`. Add `totalCost: loaded.totalCost` to the `createTask` and `updateTask` return objects.

- [ ] **Step 4: Add the spawn cost total to the status result**

  In `updateAssignmentStatus`, sum `costToNumber(nextView.cost)` for **every** spawned row into `spawnedCostTotal` and include it in the returned object (keep `nextAssignment` as the closing assignee's successor).

- [ ] **Step 5: Run the tests to verify they pass**

  Run `pnpm vitest run actions/tasks/tasks.test.ts -t "recost"` and `pnpm vitest run actions/tasks/tasks.test.ts -t "createTask"`. Expected: PASS.

- [ ] **Step 6: Verify types and lint**

  Run `pnpm typecheck` and `pnpm eslint actions/tasks`. Expected: no errors.

---

### Task 3: Default cost field in step one of the task form

**Files:**
- Modify: `components/projects/task-dialog.tsx`
- Modify: `components/projects/task-form.tsx`
- Modify: `components/projects/task-form-details-step.tsx`
- Modify: `stores/project-tasks/use-project-tasks-actions.ts`
- Modify: `components/projects/tasks-card.tsx`
- Modify: `messages/en.json`, `messages/es.json`
- Test: `e2e/task-wizard-validation.spec.ts`

**Interfaces:**
- Consumes: `MoneyInput`, `TaskFormValues`, `toTaskPayload`, `buildOptimisticTask`.
- Produces: `TaskFormValues.cost: string`; form state `cost` and `onCostChange`; `TaskWithAssignmentsDTO.cost`/`totalCost` populated on optimistic create/edit.

- [ ] **Step 1: Write the failing e2e test**

  Add a test to `e2e/task-wizard-validation.spec.ts`: sign in as `user1`, open Add Task, assert the dialog has a cost field labelled from `common.cost`, fill `150`, name the task, continue, set a due date of today, submit, then reopen the task's edit dialog and assert the cost field is prefilled with `150`. Cost cells and totals are asserted in Tasks 4 and 5.

- [ ] **Step 2: Run the test to verify it fails**

  Run `pnpm test:e2e -- e2e/task-wizard-validation.spec.ts -g "cost"`. Expected: FAIL (no cost field).

- [ ] **Step 3: Thread the field through the form**

  Add `cost: string` to `TaskFormValues`; add `const [cost, setCost] = useState(task?.cost ?? "")` in `TaskForm`; pass `cost`/`onCostChange={setCost}` to `TaskFormDetailsStep` and include `cost` in `handleSubmit`'s `onSubmit` payload. In `TaskFormDetailsStep`, add a `Field` with `FieldLabel htmlFor="cost"` and `<MoneyInput id="cost" value={cost} onChange={onCostChange} />` next to the name/description fields.

- [ ] **Step 4: Carry cost into payloads and optimistic rows**

  Add `cost: values.cost` in `toTaskPayload`; in `buildOptimisticTask`, set each new assignment's `cost` to `data.cost || "0"`, the task's `cost` to the same, and `totalCost` to the sum of the built assignments' costs (the server value replaces it on commit).

- [ ] **Step 5: Add translations**

  Add `projects.tasks.totalCost` to both locale files (`"Total cost"` / `"Costo total"`). Reuse existing `common.cost`; add no other keys.

- [ ] **Step 6: Run the test to verify it passes**

  Run `pnpm test:e2e -- e2e/task-wizard-validation.spec.ts -g "cost"`. Expected: PASS.

- [ ] **Step 7: Verify types and lint**

  Run `pnpm typecheck` and `pnpm eslint components/projects stores/project-tasks`. Expected: no errors.

---

### Task 4: Inline recosting and optimistic total updates

**Files:**
- Create: `components/projects/assignment-cost-input.tsx`
- Modify: `components/projects/assignment-columns.ts`
- Modify: `components/projects/task-open-assignment-rows.tsx`
- Modify: `components/projects/task-closed-assignment-rows.tsx`
- Modify: `stores/project-tasks/project-tasks-reducer.ts`
- Modify: `stores/project-tasks/use-project-tasks-actions.ts`
- Test: `stores/project-tasks/project-tasks-store.test.ts`
- Test: `e2e/task-costs.spec.ts` (new)

**Interfaces:**
- Consumes: `MoneyInput`, `useDebounced(callback, 300)`, `useProjectContextState().projectId`, `useProjectTasksActions().updateAssignmentCost(projectId, taskId, assignmentId, cost)`, `TaskAssignmentDTO.cost`.
- Produces:
  - `AssignmentCostInput({ taskId, assignmentId, value }: AssignmentCostInputProps)`.
  - `assignmentColumnCount(canMutate: boolean)` returns `8` / `7`.
  - `ProjectTaskAction` cases `setAssignmentCost` (`taskId`, `assignmentId`, `cost`, `costDelta`) and optional `costDelta` on `upsertAssignment` and `setArchived`.
  - `useProjectTasksActions().updateAssignmentCost(projectId, taskId, assignmentId, cost)`.
  - `AssignmentStatusResultDTO.spawnedCostTotal` drives the status commit delta; unarchive uses `sumCosts(r.data.spawned)`.

- [ ] **Step 1: Write the failing reducer tests**

  In `stores/project-tasks/project-tasks-store.test.ts`: (a) `setAssignmentCost` with `cost: "80"` and `costDelta: -40` changes the matching assignment and reduces that task's `totalCost` by 40; (b) `upsertAssignment` with `nextAssignment` and `costDelta: 120` adds a successor and raises `totalCost` by 120; (c) `setArchived` with `spawned` and `costDelta: 240` adds both rows and raises `totalCost` by 240.

- [ ] **Step 2: Run the tests to verify they fail**

  Run `pnpm vitest run stores/project-tasks/project-tasks-store.test.ts -t "cost"`. Expected: FAIL (action types missing).

- [ ] **Step 3: Implement the reducer cases**

  Add the `setAssignmentCost` case and the optional `costDelta` fields; apply `Math.max(0, task.totalCost + (action.costDelta ?? 0))` everywhere `closedCount` currently applies its delta. Do not recompute a total from loaded rows.

- [ ] **Step 4: Add the store action**

  In `use-project-tasks-actions.ts`, add `updateAssignmentCost(projectId, taskId, assignmentId, cost)`: read the current assignment from the store, compute `costDelta = costToNumber(cost || "0") - costToNumber(current.cost)`, pend `setAssignmentCost`, commit with the server DTO and `costDelta: 0`, settle with a toast. In `updateAssignmentStatus`'s `commitAction`, pass `costDelta: r.data.spawnedCostTotal`; in `unarchiveTask`'s `commitAction`, pass `costDelta: sumCosts(r.data.spawned)`.

- [ ] **Step 5: Build the inline input component**

  Create `AssignmentCostInput` with local state seeded from `value`, a `useDebounced` callback (300 ms) that calls `updateAssignmentCost(projectId, taskId, assignmentId, parsed)` where `parsed` is the `MoneyInput` value normalized to `"0"` when empty, and an effect that resyncs local state when `value` changes externally. Memoize handlers with `useCallback` where the body exceeds one line.

- [ ] **Step 6: Render the cost cells**

  `assignmentColumnCount` → `8` / `7`. Add a cost cell to both row components, rendering `AssignmentCostInput` for owners/admins and `Money` for everyone else; change filler cells to `columnCount - 4`. The input reads `projectId` from context, so no new prop is threaded through `tasks-table.tsx`.

- [ ] **Step 7: Write the e2e recost test**

  New `e2e/task-costs.spec.ts`: sign in as `user1`, create a task with cost 100 for one assignee, expand the row, fill the assignment cost input with `150`, wait past the debounce, assert the input and task-row total both show `150`, reload the page and assert `150` persisted.

- [ ] **Step 8: Run the tests to verify they pass**

  Run `pnpm vitest run stores/project-tasks/project-tasks-store.test.ts -t "cost"`, then `pnpm test:e2e -- e2e/task-costs.spec.ts`. Expected: PASS.

- [ ] **Step 9: Verify types and lint**

  Run `pnpm typecheck` and `pnpm eslint components/projects stores/project-tasks lib/tasks/cost.ts`. Expected: no errors.

---

### Task 5: Read-only cost display on task rows and in My Tasks

**Files:**
- Modify: `components/projects/tasks-table.tsx`
- Modify: `components/my-tasks/my-tasks-list.tsx`
- Test: `e2e/task-costs.spec.ts`

**Interfaces:**
- Consumes: `TaskWithAssignmentsDTO.totalCost`, `MyAssignmentDTO.cost`, `Money`.
- Produces: a total-cost column on the tasks table and a cost column on both My Tasks views.

- [ ] **Step 1: Write the failing e2e test**

  In `e2e/task-costs.spec.ts`: sign in as `user1`, create a task with two assignees and cost `75`, assert the task row's total reads double `75`, then sign in as the assignee (`signInAs("user2")`) and assert My Tasks shows `75` for that assignment in the active and past tabs.

- [ ] **Step 2: Run the test to verify it fails**

  Run `pnpm test:e2e -- e2e/task-costs.spec.ts -g "total"`. Expected: FAIL (columns absent).

- [ ] **Step 3: Render the task-row total**

  In `tasks-table.tsx`, add a `TableHead` labelled `projects.tasks.totalCost` and a `TableCell` with `<Money value={task.totalCost} />` after the due-date column.

- [ ] **Step 4: Render My Tasks cost**

  In `my-tasks-list.tsx`, add a `TableHead` labelled `common.cost` and a `TableCell` with `<Money value={assignment.cost} />` before the actions/comments column; keep it read-only in both the normal and `readOnly` views.

- [ ] **Step 5: Run the test to verify it passes**

  Run `pnpm test:e2e -- e2e/task-costs.spec.ts -g "total"`. Expected: PASS.

- [ ] **Step 6: Verify types, lint, and full verification**

  Run `pnpm typecheck`, `pnpm eslint components/projects components/my-tasks`, then `pnpm verify`. Expected: no errors, coverage thresholds met.

---

## Self-Review Notes

- Spec coverage: template semantics (Task 1), inline recost (Tasks 2 & 4), server total over all rows (Task 1), task-row total (Task 5), My Tasks display (Task 5), permissions (Task 2 & 4), translations (Task 3), tests (all).
- The status action's `spawnedCostTotal` is the one schema widening: `nextAssignment` reports only the closing assignee's successor, so healed members' costs would otherwise be missing from the delta.
- No commit steps, per `AGENTS.md`.
