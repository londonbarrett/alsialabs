# Assignment Performance Comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage assignment cost and a single performance note in one row-level save, show the note read-only in My Tasks, and remove the old debounced cost write.

**Architecture:** One combined safe action writes both columns in a single leaf query; a page-scoped optimistic store mutation pends both fields with the existing closed-only cost delta and drives the global loading bar through `useOptimisticAction.run()`. A colored react-hook-form hook owns the draft and the failed-save guard; a cells component renders cost, note, and a Save button in all three hosts of the assignment rows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle/PostgreSQL, next-safe-action, Zustand optimistic stores, react-hook-form, next-intl, Tailwind/shadcn, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-assignment-performance-comment-design.md`

## As-built adjustments (final UI)

The task steps below describe the original implementation and were followed in
order during delivery. Subsequent user-directed adjustments changed only the
presentation; the server action, optimistic store, and form hook are unchanged.
Where the steps below disagree with this section, **this section wins** — see
the spec for the full final-state description.

- `AssignmentDetailsCells` renders **two** cells: cost and comment. On Tasks the
  comment cell uses `colSpan={3}` with `px-10` padding; on Expenses it stays one
  column. The comment input grows to fill the cell, has no visible label, and
  uses `common.comments` as its placeholder ("Comments" / "Comentarios").
- Save is always present as a labelled button (`Save` icon + `common.save`,
  "Save" / "Guardar"), disabled until a field changes or while saving. Its icon
  swaps to `Spinner` during the request; the global bar also runs. It is no
  longer icon-only with `aria-label="common.saveChanges"`, and it no longer
  appears/disappears with `isDirty`.
- Task row: **name → status → due date → total cost → priority → assignees →
  actions**, recurring badge inline with the title, due date date-only.
- Assignment row: **assignee → status → due date → cost → comment (3 columns) →
  actions**, due date date-only via `formatAssignmentDueDate`.
- My Tasks: the note moved out of the task-name cell into its own **Comment**
  column after Cost; the separate `common.comments` count column is unchanged.
- The retired `dateOnly` prop and the old `assignment-cost-input.tsx` are gone.
  `AssignmentDetailsCells` takes an optional `commentColSpan` (default `1`).
- E2E selectors use `getByRole("textbox", { name: "Comentarios" })` and
  `getByRole("button", { name: "Guardar" })`; cell indices in Tasks/Expenses
  specs follow the final column order above.

## Global Constraints

- Never commit or push without explicit user permission (AGENTS.md). Every task ends with changes left uncommitted; do not run `git commit`.
- Package manager is `pnpm`. Use `pnpm vitest run <path> -t "<name>"`, `pnpm typecheck`, `pnpm eslint <paths>`, `pnpm verify`, `pnpm test:e2e`.
- No database migration: `task_assignment.comment` (nullable `text`) and `cost` (`decimal(12,2)`, not null, default `"0"`) already exist, as do `TaskAssignmentSchema.comment` and `MyAssignmentSchema.comment`.
- Server actions follow `actions/tasks/` layout: `"use server"` only in `actions.ts`, all DB work in `queries.ts`, barrel re-exports only from `actions.ts`, DTOs inferred in `schemas.ts`.
- Authorization is `canManageWork(ctx.projectRole)` (owner or admin) from `lib/util/project-roles.ts`. No new permission code.
- Every form uses react-hook-form with all logic in a colocated hook; the component only wires values and handlers.
- One component per file. No `any`. No hand-editing `drizzle/`.
- `messages/en.json` and `messages/es.json` must stay structurally identical; reuse existing keys before adding `projects.tasks.comment`.
- Cost normalization: empty input stores `"0"`. Comment normalization: trim, cap 2000 characters, empty stores `null`.

## Review Focus

- **A failed save must not erase the manager's typed draft** — the optimistic discard reverts props, so unconditional prop adoption would wipe the note. Test: `use-assignment-details-form.test.tsx`, "keeps the draft and isDirty true when the mutation fails" (Task 3).
- **A crafted assignment id from another task or project must not write anything** — the scoped read must include both project and taskId. Test: `tasks.test.ts`, "rejects an assignment outside the input task/project without an update" (Task 1).
- **A closed history row absent from the store must still save both fields and move `totalCost`** — a pend that inserts a fake row would corrupt the list. Test: `use-project-tasks-actions.test.ts`, "a fetched history row pends without inserting an assignment" (Task 2).
- **Empty cost and blank comment must round-trip as `"0"` and `null`** — otherwise a reload shows a stale note or a validation error. Test: `tasks.test.ts`, "cleared cost stores zero" and "blank comment stores null" (Task 1).
- **Header and filler-cell counts must stay aligned across Tasks, Expenses, and the history panel** — an off-by-one silently shifts columns. Test: updated `e2e/task-table-layout.spec.ts` and `e2e/expense-task-layout.spec.ts` (Task 4).

---

### Task 1: Combined server action and leaf query

**Files:**
- Modify: `actions/tasks/schemas.ts`
- Modify: `actions/tasks/actions.ts` (remove `updateAssignmentCost`, `updateAssignmentComment`)
- Modify: `actions/tasks/queries.ts` (remove `updateAssignmentCost`, `updateAssignmentComment`, add `updateAssignmentDetails`)
- Modify: `actions/tasks/index.ts`
- Test: `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `CostInputSchema` (private in `schemas.ts`), `projectAction`, `canManageWork`, `returnActionError`, `queries.getAssignmentForRow`, `queries.getAssignmentViewById`, `loadTimeZone`, `toTaskAssignmentDTO`, `TaskAssignmentSchema`.
- Produces: `UpdateAssignmentSchema = { projectId: string; taskId: string; assignmentId: string; cost: string; comment: string }` (cost uses `CostInputSchema`, comment `z.string().max(2000)`); `UpdateAssignmentDTO`; `updateAssignment(input)` safe action returning `TaskAssignmentDTO`; `queries.updateAssignmentDetails(assignmentId, cost, comment): Promise<void>`.

- [ ] **Step 1: Add failing tests to `actions/tasks/tasks.test.ts`**

Replace the `describe("updateAssignmentCost (recost)")` and `describe("updateAssignmentComment")` blocks with one `describe("updateAssignment")`. Reuse existing helpers `state`, `grantAccess`, `makeAssignmentRow`, and define:

```ts
const updateInput = {
  projectId: PROJECT_ID,
  taskId: TASK_ID,
  assignmentId: ASSIGNMENT_ID,
  cost: "150",
  comment: "note",
}

function mockScopedAssignment(taskId = TASK_ID) {
  state.mock.onSelect(schema.taskAssignmentsTable).respond([
    { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo",
      endDate: at("2026-10-30", "11:00:00"), taskId },
  ])
}

function mockView(cost = "150", comment: string | null = "note") {
  state.mock.onSelect(schema.taskAssignmentDetailView)
    .respond([makeAssignmentRow({ cost, comment })])
}

function detailsUpdates(since: number) {
  return state.mock.calls.slice(since)
    .filter((c) => c.sql.includes('update "task_assignment"'))
}
```

Tests, with these exact assertions:
- "writes cost and comment in one update and returns both in the DTO": mock scoped row, `.onUpdate(...).respond([])`, mockView; call `updateAssignment(updateInput)`; expect `result.serverError` undefined, `result.data?.cost === "150"`, `result.data?.comment === "note"`, `detailsUpdates(before)` length 1, and that update's `params` contains `"150"` and `"note"`.
- "cleared cost stores zero": `updateAssignment({ ...updateInput, cost: "" })`, mockView("0"); expect `data.cost === "0"` and the single update's `params` contains `"0"`.
- "blank comment stores null": `updateAssignment({ ...updateInput, comment: "   " })`, mockView("150", null); expect `data.comment === null` and update `params` contains `null`.
- "collaborator is forbidden": `grantAccess("collaborator")`; expect `result.serverError` equals `{ code: "FORBIDDEN" }` and zero updates.
- "rejects an assignment outside the input task/project without an update": `mockScopedAssignment("another-task")`; expect `result.serverError?.code` to be `"NOT_FOUND"` and zero updates; also assert the scoped select SQL contains `project_id` and its params contain `ASSIGNMENT_ID` and `PROJECT_ID`.
- "rejects a comment over 2000 characters": `updateAssignment({ ...updateInput, comment: "x".repeat(2001) })`; expect a validation error and zero updates.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "updateAssignment"`
Expected: FAIL — `updateAssignment` is not exported.

- [ ] **Step 3: Implement the action and query**

In `actions/tasks/schemas.ts`, add `UpdateAssignmentSchema` next to `UpdateAssignmentCostSchema` using `CostInputSchema` for `cost` and `z.uuid()` for the three ids; replace `UpdateAssignmentCostDTO` with `UpdateAssignmentDTO = z.infer<typeof UpdateAssignmentSchema>`.

In `actions/tasks/queries.ts`, replace both single-field writers with one leaf query:

```ts
async function updateAssignmentDetails(
  assignmentId: string,
  cost: string,
  comment: string | null
): Promise<void>
```

Body: one `db.update(taskAssignmentsTable).set({ cost, comment }).where(eq(taskAssignmentsTable.id, assignmentId))`. Update the exported query object at the bottom of the file (remove the two old keys, add this one).

In `actions/tasks/actions.ts`, replace the two old actions with:

```ts
export const updateAssignment = projectAction(UpdateAssignmentSchema)
  .metadata({})
  .outputSchema(TaskAssignmentSchema)
  .action(async ({ parsedInput, ctx }) => { ... })
```

Body order: `canManageWork` guard → `queries.getAssignmentForRow(parsedInput.assignmentId, parsedInput.projectId)` → `NOT_FOUND` if missing or `row.taskId !== parsedInput.taskId` → `loadTimeZone(projectId)` → `queries.updateAssignmentDetails(assignmentId, cost || "0", comment.trim() || null)` → `queries.getAssignmentViewById(assignmentId)` → `NOT_FOUND` if missing → return `toTaskAssignmentDTO(viewRow, timeZone)`. Remove now-unused `canChangeAnyAssignment` import if nothing else uses it in that file.

In `actions/tasks/index.ts`, replace the two barrel exports with `updateAssignment`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "updateAssignment"`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check and leave changes uncommitted**

Run: `pnpm typecheck && git status --short`
Expected: no type errors; modified files listed, nothing committed.

---

### Task 2: Optimistic store mutation and reducer action

**Files:**
- Modify: `stores/project-tasks/project-tasks-reducer.ts`
- Modify: `stores/project-tasks/use-project-tasks-actions.ts`
- Test: `stores/project-tasks/project-tasks-store.test.ts`
- Test: `stores/project-tasks/use-project-tasks-actions.test.ts`

**Interfaces:**
- Consumes: `updateAssignment` safe action from `@/actions/tasks`, `closedCostDelta`, `run`, `settle`, `SettleResult`.
- Produces: reducer action `{ type: "setAssignmentDetails"; taskId: string; assignmentId: string; cost: string; comment: string | null; costDelta: number }`; store method `updateAssignment(projectId: string, taskId: string, assignmentId: string, cost: string, comment: string | null, previousCost: string, terminal?: boolean): Promise<SettleResult>`.

- [ ] **Step 1: Add failing reducer tests to `stores/project-tasks/project-tasks-store.test.ts`**

Beside the existing `setAssignmentCost` tests, add:
- "setAssignmentDetails replaces cost and comment and moves totalCost by costDelta": dispatch for a store-backed closed assignment with `cost: "150"`, `comment: "note"`, `costDelta: 50`; expect that assignment's two fields changed and `task.totalCost` increased by 50.
- "a fetched history row pends without inserting an assignment": dispatch for an id absent from `assignments`; expect `assignments` length unchanged but `totalCost` still moved by `costDelta`.

- [ ] **Step 2: Add failing hook tests to `stores/project-tasks/use-project-tasks-actions.test.ts`**

In a new `describe("useProjectTasksActions().updateAssignment")`:
- "pends both fields, calls the action with both fields, and commits the server row": set `mocks.tasks = []`, `mocks.executeAsync.mockResolvedValue({ data: makeAssignment({ cost: "150.00", comment: "note" }) })`; call `actions.updateAssignment("project-1", "task-1", "fetched-history-row", "150", "note", "100")`; expect `mocks.pend` called with `{ type: "setAssignmentDetails", taskId: "task-1", assignmentId: "fetched-history-row", cost: "150", comment: "note", costDelta: 50 }`; expect `mocks.executeAsync` called with `{ projectId: "project-1", taskId: "task-1", assignmentId: "fetched-history-row", cost: "150", comment: "note" }`; expect `mocks.commit` called with `cost: "150.00"`, `comment: "note"`, `costDelta: 0`; expect `mocks.settle` called and the returned value to be `{ success: true }`.
- "an open-row edit leaves totalCost unchanged": pass `terminal = false` and expect `costDelta: 0`.
- "a failed mutation discards and returns failure": `mocks.executeAsync.mockResolvedValue({ serverError: { code: "FORBIDDEN" } })`; expect `mocks.discard` called, `mocks.commit` not called, and the result to have `success: false`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run stores/project-tasks`
Expected: FAIL — reducer case and store method do not exist.

- [ ] **Step 4: Implement reducer action and store method**

In `project-tasks-reducer.ts`, add the `setAssignmentDetails` union member and a `case` that, for the matching task, adjusts `totalCost` by `action.costDelta` and maps matching assignment ids to `{ ...a, cost: action.cost, comment: action.comment }` — never appending a new assignment.

In `use-project-tasks-actions.ts`, import `updateAssignment as updateAssignmentAction` from `@/actions/tasks` (remove the two old imports), add `const { executeAsync: executeUpdate } = useAction(updateAssignmentAction)` next to the existing execute hooks, and implement `updateAssignment(...)` with the exact signature above: compute `nextCost = cost || "0"`, `costDelta = closedCostDelta({ cost: previousCost || "0", terminal }, { cost: nextCost, terminal })`, call `run(...)` pending `setAssignmentDetails`, commit via `setAssignmentDetails` with the server row and `costDelta: 0`, then `return settle(result, t("projects.tasks.comments.commentUpdated"))`. Remove the two old methods and their barrel usage in the returned object.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run stores/project-tasks`
Expected: PASS.

- [ ] **Step 6: Type-check and leave changes uncommitted**

Run: `pnpm typecheck && git status --short`
Expected: no type errors; nothing committed.

---

### Task 3: Draft-owning form hook and assignment cells component

**Files:**
- Create: `components/projects/tasks/use-assignment-details-form.ts`
- Create: `components/projects/tasks/assignment-details-cells.tsx`
- Delete: `components/projects/tasks/assignment-cost-input.tsx`
- Test: `components/projects/tasks/use-assignment-details-form.test.tsx`

**Interfaces:**
- Consumes: `updateAssignment` from `useProjectTasksActions`, `useForm`/`useWatch` from react-hook-form, `MoneyInput`, `Spinner`, `Button`, `Input` (shadcn).
- Produces: `useAssignmentDetailsForm(params: { projectId: string; taskId: string; assignmentId: string; cost: string; comment: string | null; terminal: boolean }): { values: { cost: string; comment: string }; setField(name: "cost" | "comment", value: string): void; isDirty: boolean; isSubmitting: boolean; save(): Promise<void> }`; `AssignmentDetailsCells(props: { taskId: string; assignmentId: string; cost: string; comment: string | null; terminal: boolean; canEdit: boolean }): ReactElement` returning exactly one `TableCell` with the cost `MoneyInput`, a visible `Comment` label above a single-line comment `Input`, and an icon-only Save button (`aria-label={t("common.saveChanges")}`, a `Save` icon or `Spinner`, no text child).

- [ ] **Step 1: Add the failing hook test (jsdom)**

Create `components/projects/tasks/use-assignment-details-form.test.tsx` with `// @vitest-environment jsdom`, `renderHook`/`act`, `vi.mock("@/stores/project-tasks/use-project-tasks-actions", ...)` returning a controllable `updateAssignment` mock, and `vi.mock("next-intl", ...)`. Tests:
- "is not dirty initially and becomes dirty after a field changes": initial `isDirty === false`; `act(() => result.current.setField("comment", "note"))`; expect `isDirty === true`.
- "adopts new props while clean": `rerender({ ...params, cost: "200", comment: "from server" })` while clean; expect `values.cost === "200"` and `values.comment === "from server"`.
- "ignores new props while dirty or submitting": make dirty, rerender with new props, expect values unchanged; then resolve a save and rerender again, expect values adopted.
- "sends both fields and resets the baseline on success": mock `updateAssignment` resolves `{ success: true }`; edit both; `await act(() => result.current.save())`; expect the store call to be `(projectId, taskId, assignmentId, "150", "note", "100", false)` and `isDirty === false`.
- "keeps the draft and isDirty true when the mutation fails": mock resolves `{ success: false }`; edit then save; expect `values.comment` retained and `isDirty === true`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run components/projects/tasks/use-assignment-details-form.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

In `use-assignment-details-form.ts`, use `useForm<{ cost: string; comment: string }>({ defaultValues: { cost, comment: comment ?? "" } })` plus `useWatch`. In an effect, call `reset({ cost, comment: comment ?? "" })` only when `!formState.isDirty && !formState.isSubmitting` (this is the failed-save guard from the spec). Expose `setField` via `setValue(name, value, { shouldDirty: true })`, `isDirty`, `isSubmitting`, and `save` via `handleSubmit(async (values) => { const result = await updateAssignment(projectId, taskId, assignmentId, values.cost, values.comment, cost, terminal); if (result.success) reset(values) })`. Do not use a `<form>` element — the component renders cells inside a table row.

- [ ] **Step 4: Implement `AssignmentDetailsCells`**

Create `assignment-details-cells.tsx`: `"use client"`, accepts the props above, calls `useAssignmentDetailsForm` with `projectId` from `useProjectContextState()` and `t` from `useTranslations()`. For `canEdit === false`, return one `TableCell` with `<Money value={cost} />` and plain read-only note text (`comment` when non-empty). For `canEdit === true`, return one `TableCell` with `<MoneyInput aria-label={t("common.cost")} value={values.cost} onChange={(v) => setField("cost", v)} />`, a visible label reading `t("projects.tasks.comment")` directly above a single-line `<Input maxLength={2000} aria-label={t("projects.tasks.comment")} value={values.comment} onChange={(e) => setField("comment", e.target.value)} />`, and, when `isDirty`, an icon-only `<Button type="button" size="icon-sm" aria-label={t("common.saveChanges")} onClick={() => void save()} disabled={isSubmitting}>` containing `<Save />` while idle and `<Spinner />` while `isSubmitting` — no text child. No new table column is involved.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run components/projects/tasks/use-assignment-details-form.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check and leave changes uncommitted**

Run: `pnpm typecheck && git status --short`
Expected: no type errors; nothing committed.

---

### Task 4: Wire all three hosts, headers, translations, and existing e2e specs

**Files:**
- Modify: `components/projects/tasks/task-open-assignment-rows.tsx`
- Modify: `components/projects/tasks/task-closed-assignment-rows.tsx`
- Modify: `components/projects/tasks/assignment-columns.ts`
- Modify: `components/projects/tasks/tasks-table.tsx`
- Modify: `components/projects/expenses/expenses-table.tsx`
- Modify: `messages/en.json`
- Modify: `messages/es.json`
- Test: `e2e/task-costs.spec.ts`
- Test: `e2e/expense-task-costs.spec.ts`
- Test: `e2e/task-table-layout.spec.ts`
- Test: `e2e/expense-task-layout.spec.ts`

**Interfaces:**
- Consumes: `AssignmentDetailsCells` props from Task 3; `assignmentColumnCount` helper.
- Produces: `assignmentColumnCount(canMutate)` returns `8` when true and `7` otherwise; Tasks table `columnCount = 7`; Expenses table `columnCount = showActions ? 5 : 4`. No new table header.

- [ ] **Step 1: Update the failing e2e assertions first**

In `e2e/task-costs.spec.ts`, replace the debounce block (the `waitForTimeout(600)` and "Tarea actualizada" assertions after `costInput.fill("150")`) with: fill the note via `getByRole("textbox", { name: "Comentario" })`, assert the Save button (`common.saveChanges` Spanish label) becomes visible, click it, assert the button disappears, then assert the persisted values after reload. Keep the existing reload assertion for `"$150"` and add one for the note text.

In `e2e/expense-task-costs.spec.ts`, at both recost sites (around lines 148 and 320), insert a click on the Save button after filling the cost and before asserting the row amount / `"Tarea actualizada"`.

In `e2e/task-table-layout.spec.ts` and `e2e/expense-task-layout.spec.ts`, keep the original expanded-row cell indices so the date cell is asserted at index 4 (Tasks) / index 3 (Expenses), and assert that the labeled comment input is visible inside the same cell as the cost input.

- [ ] **Step 2: Run the e2e specs to verify they fail**

Run: `pnpm test:e2e -- e2e/task-costs.spec.ts e2e/expense-task-costs.spec.ts e2e/task-table-layout.spec.ts e2e/expense-task-layout.spec.ts`
Expected: FAIL — no Save button or labeled comment input exists yet.

- [ ] **Step 3: Wire the cells into the row components**

In `task-open-assignment-rows.tsx` and `task-closed-assignment-rows.tsx`, replace the cost `TableCell` and `AssignmentCostInput` with `<AssignmentDetailsCells taskId={...} assignmentId={...} cost={assignment.cost} comment={assignment.comment} terminal={isTerminalStatus(assignment.status)} canEdit={isOwner || isAdmin} />`. In the closed-row component, place it in the `leadingCells` position currently occupied by `costCell` in both `cellOrder` branches, and compute filler cells from the number of cells actually rendered (5 for `"tasks"`, 4 for `"expenses"`). In the open-row component, keep `columns - 5`. Delete `assignment-cost-input.tsx` after confirming no imports remain.

- [ ] **Step 4: Keep headers and column counts unchanged**

Do not add a comment/note header. In `tasks-table.tsx`: `columnCount = 7`, the `min-w-275 table-fixed` class and the original total-cost/actions header widths. In `expenses-table.tsx`: `columnCount = showActions ? 5 : 4` and the original percentage widths. In `assignment-columns.ts`: return `canMutate ? 8 : 7`. `TaskHistoryPanel` forwards its count from the Tasks table, so no change there beyond verifying the forwarded value is 7.

- [ ] **Step 5: Add translations**

Add `"comment": "Comentario"` under `projects.tasks` in `messages/es.json` and `"comment": "Comment"` in `messages/en.json`, in the same position in both files. Reuse `common.saveChanges` and `common.cost`; do not modify dynamic key maps.

- [ ] **Step 6: Run the e2e specs to verify they pass**

Run: `pnpm test:e2e -- e2e/task-costs.spec.ts e2e/expense-task-costs.spec.ts e2e/task-table-layout.spec.ts e2e/expense-task-layout.spec.ts`
Expected: PASS.

- [ ] **Step 7: Lint and leave changes uncommitted**

Run: `pnpm eslint components/projects/tasks components/projects/expenses && git status --short`
Expected: zero warnings; nothing committed.

---

### Task 5: Read-only note in My Tasks and end-to-end coverage

**Files:**
- Modify: `components/my-tasks/my-tasks-list.tsx`
- Test: `components/projects/due-date.test.tsx`
- Test: `e2e/assignment-performance-comment.spec.ts`

**Interfaces:**
- Consumes: `MyAssignmentDTO.comment` (already present in `MyAssignmentSchema` and the query).
- Produces: no new exported symbols.

- [ ] **Step 1: Add failing unit and e2e tests**

In `components/projects/due-date.test.tsx`, add to `describe("MyTasksList dates")`:
- "shows the performance note under the task name and no editing affordance": render with `assignmentRow({ comment: "Delivered early" })` and `readOnly: true`; expect markup contains `"Delivered early"` and no `"Comentario"` textbox.
- "shows no note element when the comment is null": expect markup not to contain the note text from the previous case.

Create `e2e/assignment-performance-comment.spec.ts` importing `test, expect` from `./fixtures` with `PROJECT_URL = "/app/proyectos/10000000-0000-4000-8000-000000000001"`. Tests:
- "an owner stages cost and comment, sees both indicators, and both persist": create a task assigned to user1 as in `e2e/task-costs.spec.ts`, expand it, fill cost `"150"` and note `"Delivered early"`, assert Save appears, click, assert `<Spinner role="status">` and the global `role="progressbar"` appear while pending, assert Save disappears, reload and re-expand, assert both values.
- "a collaborator reads the note inline in My Tasks and cannot edit it": sign in as a collaborator assigned to that task, `page.goto("/app/mis-tareas")`, find the task row, assert the note text is visible under the name, assert no Save button and no note textbox in that row.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run components/projects/due-date.test.tsx -t "performance note" && pnpm test:e2e -- e2e/assignment-performance-comment.spec.ts`
Expected: FAIL — note is not rendered.

- [ ] **Step 3: Render the note in My Tasks**

In `components/my-tasks/my-tasks-list.tsx`, inside the first `TableCell` after the description paragraph, render `{assignment.comment && (<p className="mt-0.5 text-xs text-muted-foreground">{assignment.comment}</p>)}`. Do not add a column, button, or translation key.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run components/projects/due-date.test.tsx -t "performance note" && pnpm test:e2e -- e2e/assignment-performance-comment.spec.ts`
Expected: PASS.

- [ ] **Step 5: Full verification and leave changes uncommitted**

Run: `pnpm verify && pnpm test:e2e && git status --short`
Expected: typecheck, lint, and coverage pass; full e2e suite passes; nothing committed. Ask the user before committing anything.

---

## Final check

- Confirm `grep -r "updateAssignmentCost\|updateAssignmentComment\|AssignmentCostInput\|useDebounced\|COST_DEBOUNCE_MS" actions/tasks stores/project-tasks components/projects/tasks components/projects/expenses` returns no live callers (docs and historical plans may still mention them, and `useDebounced` may legitimately remain in unrelated domains).
- Confirm `pnpm verify` and `pnpm test:e2e` pass before reporting completion.
