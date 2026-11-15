# Multi-assignee Tasks (Phase 2) Implementation Plan

> **Superseded in parts by spec amendments:** see the design doc's §4 UI sequence (dialog at chip removal; field renamed `unassignAs`) and Decided #2 (last assignment per assignee).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the multi-assignee task UI — multi-select picker, open-work task list with avatar stack/counts/expandable per-person rows, unassign-with-disposition flow, and member removal that cancels open assignments.

**Architecture:** No schema changes. The list filters existing `TaskWithAssignmentsDTO[]` client-side with a pure predicate; the table renders only open assignments in expandable sub-rows. Server-side, `syncTaskAssignments` and `deleteProjectMembership` **close** (never delete) open `task_assignment` rows; closing via sync never spawns a successor. A reusable `ActionConfirmDialog` drives the three-option unassign confirmation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle/PostgreSQL, next-safe-action + Zod, base-ui (Select/DropdownMenu/Dialog), Tailwind v4 + shadcn-style components, next-intl, Zustand optimistic stores, vitest + vitest-drizzle-mock, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-11-multi-assignee-phase2-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- No database schema changes, no `drizzle/` edits, no new npm dependencies.
- `messages/en.json` and `messages/es.json` stay structurally identical; add every key to both in the same task. ICU plural syntax has precedent (`{count, plural, ...}` already appears 3× in each file).
- Coverage floors enforced by `pnpm verify`: 60% lines/functions/statements, 50% branches.
- **No commits without explicit user approval** (AGENTS.md). Each task ends with tests green; ask the user before committing. The pre-commit hook runs `pnpm verify` + `pnpm test:e2e`.
- e2e locale is Spanish: locators use Spanish labels ("Completado", "Agregar Tarea", …); import `test`/`expect` from `./fixtures` and use `signInAs`.
- One component per file; no `any`; no new explanatory comments beyond what surrounding code does.
- Avatars in the collapsed-row stack are **decorative** (`alt=""`, no `title`, no aria-label) so a row's accessible name stays task-scoped and `getByRole("row", { name: /task name/ })` keeps matching only the task row. Names/emails appear only in expanded sub-rows, picker chips, and the picker menu.
- Status semantics: open = `status NOT IN ('done','cancelled')` (reuse `isTerminalStatus` from `@/lib/util/project-roles`).

## Review Focus

Five failure modes no single task's happy path exercises; each has its pinning test in the owning task:

1. **Stacked dialogs** — the unassign `ActionConfirmDialog` opens on top of the still-open `TaskDialog`; base-ui nested dialogs can trap or lose focus. Pinned by Task 6 e2e test 2: Cancel closes only the confirm, the form stays open with its values.
2. **Sync without a disposition** (race: an occurrence spawns while the form is open) must close as `cancelled`, never delete. Pinned by Task 2 unit test "closes removed rows as cancelled when no disposition is sent".
3. **Unassign must never spawn a successor**, even on a repeating task. Pinned by Task 2 unit test "performs no insert when only removing" (zero `onInsert(taskAssignmentsTable)` calls when the diff is removal-only).
4. **Predicate expiry edges** — open work always shows (past due included); `endDate = null` never expires; a `done` row hides; end-of-day inclusive. Pinned by Task 1 unit tests and Task 6 e2e test 2's lingering assertion.
5. **Membership removal scope** — closes only the removed user's open rows, only in that project. Pinned by Task 3 unit test capturing update params (`cancelled`, the userId, and a task-id subquery filtered by projectId).

---

### Task 1: List visibility predicate + status counts

**Files:**
- Create: `lib/tasks/filter.ts`
- Test: `lib/tasks/filter.test.ts`

**Interfaces:**
- Consumes: `TaskAssignmentDTO` from `@/actions/tasks/schemas`; `isTerminalStatus` from `@/lib/util/project-roles`.
- Produces (Task 5 relies on these exact names):
  - `isOpenAssignment(a: { status: string }): boolean`
  - `shouldShowTask(task: { assignments: TaskAssignmentDTO[]; endDate: Date | null }, now: Date): boolean`
  - `assignmentCounts(assignments: TaskAssignmentDTO[]): { open: number; blocked: number; review: number }`

- [ ] **Step 1: Write the failing tests**

`lib/tasks/filter.test.ts` — helper `assignment(status: string): TaskAssignmentDTO` filling every DTO field (`id`, `taskId`, `userId`, `userName`/`userEmail`/`userImage` null, `comment` null, `startDate`/`endDate` null) with the given status. Cases:

```ts
import { describe, expect, it } from "vitest"
import { assignmentCounts, shouldShowTask } from "./filter"

const NOW = new Date("2026-11-11T15:00:00")

it("shows a task with an open assignment even when its due date has passed", () => {
  expect(shouldShowTask({ assignments: [assignment("blocked")], endDate: new Date("2026-11-01T00:00:00") }, NOW)).toBe(true)
})
it("hides a task with a done assignment while its due date is still valid", () => {
  expect(shouldShowTask({ assignments: [assignment("done")], endDate: new Date("2026-12-01T00:00:00") }, NOW)).toBe(false)
})
it("shows an all-cancelled task until its due date passes", () => {
  expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: new Date("2026-12-01T00:00:00") }, NOW)).toBe(true)
  expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: new Date("2026-11-10T00:00:00") }, NOW)).toBe(false)
})
it("stays visible through the whole end day (end-of-day inclusive)", () => {
  expect(shouldShowTask({ assignments: [], endDate: new Date("2026-11-11T09:00:00") }, NOW)).toBe(true)
})
it("never expires when endDate is null", () => {
  expect(shouldShowTask({ assignments: [assignment("cancelled")], endDate: null }, NOW)).toBe(true)
  expect(shouldShowTask({ assignments: [], endDate: null }, NOW)).toBe(true)
})
it("hides an unassigned task whose due date has passed", () => {
  expect(shouldShowTask({ assignments: [], endDate: new Date("2026-11-10T00:00:00") }, NOW)).toBe(false)
})
it("counts blocked and in_review inside open", () => {
  expect(assignmentCounts([assignment("todo"), assignment("blocked"), assignment("in_review"), assignment("done")]))
    .toEqual({ open: 3, blocked: 1, review: 1 })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run lib/tasks/filter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/tasks/filter.ts`**

`shouldShowTask` logic, in order:
1. `assignments.some(isOpenAssignment)` → `true` (open work always shows, regardless of dates).
2. `assignments.some(a => a.status === "done")` → `false`.
3. `!endDate` → `true` (null end never expires).
4. Otherwise visible while `now` is within the endDate's calendar day: compare against the **end of that day** (local time), i.e. visible all day on the due date itself.

`assignmentCounts`: `open` = count of non-terminal; `blocked` = `status === "blocked"`; `review` = `status === "in_review"` (both included in `open`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run lib/tasks/filter.test.ts`
Expected: PASS (all 7).

- [ ] **Step 5: Ask the user to approve a commit**

---

### Task 2: Unassign closes assignments server-side

**Files:**
- Modify: `actions/tasks/schemas.ts` (`UpdateTaskSchema`, ~line 128)
- Modify: `actions/tasks/queries.ts` (`syncTaskAssignments`, line 591)
- Modify: `actions/tasks/actions.ts` (`updateTask`, line 101)
- Test: `actions/tasks/tasks.test.ts` (updateTask describe, line 225), `actions/tasks/schemas.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `UpdateTaskSchema` gains optional `removedOpenAs?: "done" | "cancelled"` → `UpdateTaskDTO.removedOpenAs`.
  - `queries.syncTaskAssignments(taskId: string, assigneeIds: string[], taskRow, removedOpenAs?: "done" | "cancelled"): Promise<void>` — 4th param optional; absent means close as `cancelled`. Removal closes via UPDATE; **never DELETE; never spawn.**

- [ ] **Step 1: Write the failing tests**

In `actions/tasks/schemas.test.ts`, add:

```ts
it("accepts an optional removedOpenAs disposition on UpdateTaskSchema", () => {
  expect(UpdateTaskSchema.safeParse({ ...validUpdate, removedOpenAs: "done" }).success).toBe(true)
  expect(UpdateTaskSchema.safeParse({ ...validUpdate, removedOpenAs: "paused" }).success).toBe(false)
})
```

(Reuse the file's existing valid-update fixture; add `removedOpenAs` cases only.)

In `actions/tasks/tasks.test.ts`, inside `describe("updateTask")`:

1. **Rewrite** the existing "diffs open assignments, keeping closed rows out of the diff" test: replace the `onDelete(schema.taskAssignmentsTable)` capture with `onUpdate(schema.taskAssignmentsTable).respondWith((_sql, params) => { updateParams = params; return [] })`. Assertions become: `expect(updateParams).toContain("open-assignment")` and `expect(updateParams).toContain("cancelled")` (default disposition). Keep the `openSql` contains `"not in"` assertion and the insert capture for `user-3`.
2. Add:

```ts
it("closes removed rows with the requested disposition", async () => {
  // same mocks as the rewrite above, but call updateTask with
  // removedOpenAs: "done" and an open row for USER_ID while assigneeIds: []
  expect(updateParams).toContain("done")
  expect(updateParams).toContain("open-assignment")
})
it("closes removed rows as cancelled when no disposition is sent", async () => {
  // open row for USER_ID, assigneeIds: [], no removedOpenAs
  expect(updateParams).toContain("cancelled")
})
it("performs no insert when only removing", async () => {
  // open row exists, assigneeIds: [], removedOpenAs: "cancelled"
  // count onInsert(schema.taskAssignmentsTable) calls → expect 0
})
```

Mirror the existing test's mock setup (projectsTable select → primaryOwnerId, projectMembershipTable select, tasksTable update → `makeTaskRow()`, taskAssignmentsTable select → `[{ id: "open-assignment", userId: USER_ID }]`, tasksTable select + taskAssignmentDetailView select for the reload). If `vitest-drizzle-mock` has no call-count helper, count invocations inside `respondWith`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:run actions/tasks/tasks.test.ts actions/tasks/schemas.test.ts`
Expected: new tests FAIL (schema rejects `removedOpenAs`; sync still deletes / never updates).

- [ ] **Step 3: Implement**

- `schemas.ts`: in `UpdateTaskSchema`'s `.extend({...})` add `removedOpenAs: z.enum(["done", "cancelled"]).optional()`.
- `queries.ts` `syncTaskAssignments`: add 4th param `removedOpenAs?: "done" | "cancelled"`. In the transaction replace the `delete` with:

```ts
await tx.update(taskAssignmentsTable)
  .set({ status: removedOpenAs ?? "cancelled" })
  .where(inArray(taskAssignmentsTable.id, toRemove))
```

`inArray` is already imported; drop `delete` usage only if now unused elsewhere in the file (check imports). No spawn logic is added — the insert branch for `toAdd` stays as-is.
- `actions.ts` `updateTask`: pass `parsedInput.removedOpenAs` as the 4th argument to `queries.syncTaskAssignments(taskId, uniqueIds, row, parsedInput.removedOpenAs)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run actions/tasks/tasks.test.ts actions/tasks/schemas.test.ts`
Expected: PASS, including pre-existing updateTask/createTask/assignment tests.

- [ ] **Step 5: Ask the user to approve a commit**

---

### Task 3: Member removal cancels open assignments

**Files:**
- Modify: `actions/projects/queries.ts` (`deleteProjectMembership`, line 549)
- Test: `actions/projects/project-membership.test.ts` ("lets an admin remove a collaborator", line 180)

**Interfaces:**
- Consumes: schema tables `taskAssignmentsTable`, `tasksTable` (add to the file's existing `@/lib/drizzle/schema` import); `notInArray` from `drizzle-orm` (add next to existing `and`/`eq` imports).
- Produces: `deleteProjectMembership(projectId, userId, role)` keeps its signature and return type; behavior now also closes that user's open assignments **in that project** as `cancelled`, in the same `db.transaction`.

- [ ] **Step 1: Write the failing test**

Extend the existing "lets an admin remove a collaborator" test (or add a sibling):

```ts
it("cancels the removed member's open assignments in that project", async () => {
  grantRole("admin")
  state.mock.onDelete(schema.projectMembershipTable)
    .respond([{ projectId: PROJECT_ID, userId: USER_ID }])
  let updateParams: unknown[] = []
  state.mock.onUpdate(schema.taskAssignmentsTable)
    .respondWith((_sql, params) => { updateParams = params; return [] })

  const result = await removeProjectCollaborator({ projectId: PROJECT_ID, userId: USER_ID })

  expect(result.serverError).toBeUndefined()
  expect(updateParams).toContain("cancelled")   // set status
  expect(updateParams).toContain(USER_ID)       // scoped to the user
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run actions/projects/project-membership.test.ts`
Expected: new test FAILS (no update issued; `onUpdate` never called → mock may error or params stay `[]`).

- [ ] **Step 3: Implement in `deleteProjectMembership`**

Wrap in `db.transaction(async (tx) => { ... })`: delete the membership row as today; if a row was removed, run

```ts
await tx.update(taskAssignmentsTable)
  .set({ status: "cancelled" })
  .where(and(
    eq(taskAssignmentsTable.userId, userId),
    notInArray(taskAssignmentsTable.status, ["done", "cancelled"]),
    inArray(taskAssignmentsTable.taskId,
      tx.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.projectId, projectId)))
  ))
```

Return the removed membership row from the transaction. Add `inArray` to the drizzle-orm import if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run actions/projects/project-membership.test.ts`
Expected: PASS — all membership tests green (existing removal/transfer tests included).

- [ ] **Step 5: Ask the user to approve a commit**

---

### Task 4: ActionConfirmDialog + all new i18n keys

**Files:**
- Create: `components/common/action-confirm-dialog.tsx`
- Modify: `messages/en.json`, `messages/es.json`

**Interfaces:**
- Consumes: `Dialog*` from `@/components/ui/dialog`, `Button` from `@/components/ui/button`, `useTranslations` — mirroring `components/common/destructive-dialog.tsx` (read it first).
- Produces (Tasks 6 and 7 rely on these):

```ts
export interface ConfirmAction {
  label: string
  onClick: () => void
  variant?: "default" | "outline" | "destructive"  // default "outline"
}
interface ActionConfirmDialogProps {
  open: boolean
  title: string
  message: string
  actions: ConfirmAction[]   // rendered left-to-right, then Cancel last
  onCancel: () => void
  loading?: boolean
}
export function ActionConfirmDialog(props: ActionConfirmDialogProps): JSX.Element
```

Behavior: controlled like `DestructiveDialog` — `onOpenChange(false)` calls `onCancel`; footer = `actions` buttons (each `onClick`, `disabled={loading}`, given `variant`) followed by an outline Cancel button labeled `t("common.cancel")`; `title`/`message` in header/description. No assignee-specific logic inside.

- [ ] **Step 1: Create the component**

Copy the structure of `destructive-dialog.tsx`; replace the single confirm button with the mapped `actions` array plus cancel. Cancel is always rendered and is the last footer child.

- [ ] **Step 2: Add every new i18n key to BOTH `messages/en.json` and `messages/es.json`**

Under `projects.tasks` (unless noted), identical structure in both files:

| key | en | es |
|---|---|---|
| `projects.tasks.openCount` | `{count, plural, one {# open} other {# open}}` | `{count, plural, one {# abierta} other {# abiertas}}` |
| `projects.tasks.blockedCount` | `{count, plural, one {# blocked} other {# blocked}}` | `{count, plural, one {# bloqueada} other {# bloqueadas}}` |
| `projects.tasks.reviewCount` | `{count, plural, one {# in review} other {# in review}}` | `{count, plural, one {# en revisión} other {# en revisión}}` |
| `projects.tasks.assignmentsToggle` | `Assignee details` | `Detalles de asignados` |
| `projects.tasks.addAssignee` | `Add assignee` | `Agregar asignado` |
| `projects.tasks.unassign.title` | `Remove assignee?` | `¿Quitar asignado?` |
| `projects.tasks.unassign.message` | `This closes their open assignment. Completed history is kept and no more occurrences will spawn for them.` | `Esto cierra su asignación abierta. El historial completado se conserva y no se generarán más ocurrencias para ellos.` |
| `projects.tasks.unassign.markDone` | `Mark as done` | `Marcar como completado` |
| `projects.tasks.unassign.markCancelled` | `Mark as cancelled` | `Marcar como cancelado` |
| `projects.removeMember.title` | `Remove member?` | `¿Eliminar miembro?` |
| `projects.removeMember.message` | `{name} will be removed from the project. Their open task assignments will be cancelled.` | `{name} será eliminado del proyecto. Sus asignaciones de tarea abiertas serán canceladas.` |
| `projects.removeMember.confirm` | `Remove` | `Eliminar` |
| `projects.removeMember.removeButton` | `Remove {name}` | `Eliminar a {name}` |

Place `removeMember.*` keys at the `projects.*` level (sibling of `projects.tasks`, near `projects.roles`). Verify both files parse: `node -e "JSON.parse(require('fs').readFileSync('messages/en.json','utf8'))"` (and `es.json`).

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm eslint components/common/action-confirm-dialog.tsx`
Expected: PASS, zero warnings.

- [ ] **Step 4: Ask the user to approve a commit**

---

### Task 5: Task table rework (filter, stack, counts, expansion)

**Files:**
- Create: `components/projects/task-assignee-stack.tsx`
- Create: `components/projects/task-assignment-rows.tsx`
- Modify: `components/projects/tasks-table.tsx`
- Modify: `components/projects/tasks-card.tsx`
- Test (e2e): update `e2e/task-assignments.spec.ts`, `e2e/repeating-tasks.spec.ts`, `e2e/task-wizard-validation.spec.ts`

**Interfaces:**
- Consumes: `shouldShowTask`, `assignmentCounts`, `isOpenAssignment` (Task 1); `sortAssignments` from `@/lib/tasks/assignments`; `TaskStatusSelect`, `taskStatusColors` from `./task-status-select`; `isTerminalStatus`; i18n keys from Task 4.
- Produces:
  - `TaskAssigneeStack({ assignments }: { assignments: TaskAssignmentDTO[] })` — decorative avatar stack for the **open** assignments passed in; shows up to 3 avatars then a `+N` badge; renders `null` for an empty array (parent renders the "Unassigned" label).
  - `TaskAssignmentRows({ taskId, assignments, onStatusChange }: { taskId: string; assignments: TaskAssignmentDTO[]; onStatusChange: (taskId: string, assignmentId: string, status: TaskStatus) => void })` — one `<tr>` per assignment (caller passes open-only, already `sortAssignments`-ordered).
  - `TasksTable` props unchanged; `TasksCard` unchanged externally.

- [ ] **Step 1: Create `task-assignee-stack.tsx`**

Avatars (`Avatar`/`AvatarImage`/`AvatarFallback` from `@/components/ui/avatar`) in a `-space-x-2` row; image `alt=""`, no title/aria-label; fallback = first 2 chars uppercased of `userName || userEmail`. Overflow: after 3 items render a `+N` badge span (`text-xs text-muted-foreground`) with the remaining count.

- [ ] **Step 2: Create `task-assignment-rows.tsx`**

For each assignment, a `<TableRow>` with cells aligned to the main row's columns:
1. name column: indented (`pl-8`) avatar + `userName || userEmail` + email beneath (`text-xs text-muted-foreground`).
2. assignee column: occurrence window — `startDate` and `endDate` as `toLocaleDateString()` short dates joined with `–`; `null` renders `—`.
3. status column: `TaskStatusSelect` with `allowedStatuses={ALL_TASK_STATUSES}` and `onStatusChange((s) => onStatusChange(taskId, assignment.id, s))`.
4. remaining columns (priority, due, comments, actions): empty `<TableCell>`s — render exactly as many as the main row (see Step 3's `columnCount`).

Sort input with `sortAssignments(assignments)` inside the component (defensive; caller may pre-sort).

- [ ] **Step 3: Rework `tasks-table.tsx`**

- Add local state `const [expanded, setExpanded] = useState<Set<string>>(new Set())`; toggle via a chevron `Button` (`variant="ghost"`, `size="icon-sm"`, `ChevronRight` rotating when open) placed before the task name, with `aria-label={t("projects.tasks.assignmentsToggle")}` and `aria-expanded`.
- Compute per task: `const open = task.assignments.filter(isOpenAssignment)`; `const counts = assignmentCounts(task.assignments)`.
- **Assignee cell**: `open.length > 0 ? <TaskAssigneeStack assignments={open} /> : <span className="text-xs text-muted-foreground">{t("common.unassigned")}</span>`.
- **Status cell**: `open.length === 0` → `t("common.unassigned")`; else join with `" · "` of: `t("projects.tasks.openCount", { count: counts.open })`, plus `blockedCount`/`reviewCount` only when > 0. **Remove** the `TaskStatusSelect`/badge block from the collapsed row entirely (the `getAllowedStatuses` helper moves to the sub-rows usage — owner/admin path only; keep the collaborator branch as-is for safety).
- **Due cell**: earliest open assignment's `endDate` (`open` is sorted by `sortAssignments` — take `open[0]?.endDate ?? null`); overdue via `isTaskOverdue(open[0].status, open[0].endDate)` when an open assignment exists, else `false`. Fallback when no open assignment: `task.endDate` with `overdue={false}` (the row's own expiry governs visibility, not styling).
- After the main `<TableRow>`, when expanded: `<TaskAssignmentRows …>` for `open`.
- Keep priority/comments/actions/recurring/description cells unchanged.
- Column count for empty sub-row cells: count `<TableHead>`s rendered (the actions head is conditional) — derive a `columnCount` from `canMutate` exactly as the header does.

- [ ] **Step 4: Wire the filter in `tasks-card.tsx`**

```ts
const visibleTasks = tasks.filter((task) => shouldShowTask(task, new Date()))
```

Use `visibleTasks` for both the empty check (`visibleTasks.length === 0` → existing `t("projects.tasks.noTasks")`) and the `TasksTable` prop. (Accepted: a non-empty store where everything is filtered out shows "No tasks yet".)

- [ ] **Step 5: Update the three e2e specs**

1. **`e2e/task-assignments.spec.ts`** — owner section becomes: goto project → `ownerRow.getByRole("button", { name: "Detalles de asignados" }).click()` → `const assigneeRow = page.getByRole("row", { name: /E2E Collaborator/ })` → assert `assigneeRow.getByText("E2E Collaborator")` and `assigneeRow.getByText("user2@test.local")` visible → `assigneeRow.getByRole("combobox").click()` → `page.getByRole("option", { name: "Completado" }).click()` → toast `"Estado actualizado"` visible. (The old main-row combobox and name/email assertions move here — the stack is decorative.)
2. **`e2e/repeating-tasks.spec.ts`** — same expansion for the owner: expand `"E2E weekly report"` row → combobox in `/E2E Collaborator/` sub-row → `"Completado"` → toast `"Siguiente ocurrencia creada"` → add `await expect(page.getByRole("row", { name: /E2E Collaborator/ })).toHaveCount(1)` (the closed occurrence left the view; exactly one open sub-row remains).
3. **`e2e/task-wizard-validation.spec.ts`** test 1 — replace the literal dates with `toDateInput(new Date())` (start) and `toDateInput(new Date())` minus… specifically: start = `toDateInput(new Date())`, first end fill = one day before start (keep the END_BEFORE_START assertion by computing `new Date(Date.now() - 86400000)` through `toDateInput`), final valid end = `toDateInput(new Date())`. Reason: the new predicate hides an unassigned task whose due date has passed; an unassigned task due *today* stays visible (end-of-day inclusive), which is what the row-exists assertion needs.

- [ ] **Step 6: Run targeted verification**

Run: `pnpm typecheck && pnpm eslint components/projects/tasks-table.tsx components/projects/tasks-card.tsx components/projects/task-assignee-stack.tsx components/projects/task-assignment-rows.tsx`
Expected: PASS.

- [ ] **Step 7: Run the affected e2e specs**

Run: `pnpm test:e2e -- task-assignments.spec.ts repeating-tasks.spec.ts task-wizard-validation.spec.ts`
Expected: PASS (this boots Docker + reseeds; the seed's `E2E wizard gate%` cleanup already handles leftovers).

- [ ] **Step 8: Ask the user to approve a commit**

---

### Task 6: Multi-select picker + unassign confirm flow + new e2e

**Files:**
- Modify: `components/projects/task-assignee-select.tsx` (rewrite)
- Modify: `components/projects/task-form-details-step.tsx` (prop types)
- Modify: `components/projects/task-form.tsx` (state + submit)
- Modify: `components/projects/tasks-card.tsx` (unassign dialog flow)
- Modify: `stores/project-tasks/use-project-tasks-actions.ts` (`updateTask` passthrough)
- Modify: `lib/drizzle/seed-e2e.ts` (cleanup pattern)
- Test: `e2e/multi-assignee.spec.ts` (create)

**Interfaces:**
- Consumes: `ActionConfirmDialog` + `ConfirmAction` (Task 4), `addAssignee`/`unassign.*` i18n keys (Task 4), `isOpenAssignment` (Task 1), counts/stack/expansion (Task 5), `isTerminalStatus`.
- Produces:
  - `TaskAssigneeSelect({ value: string[]; onChange: (value: string[]) => void; members: ProjectMemberRowDTO[] })`.
  - `TaskForm` submits `assigneeIds` as the full array (no wrapping).
  - `useProjectTasksActions().updateTask({ projectId, taskId, values, optimisticTask, removedOpenAs?: "done" | "cancelled" })` → sends `removedOpenAs` in the action payload.

- [ ] **Step 1: Rewrite `task-assignee-select.tsx` as a multi-select**

Props per Interfaces. UI (base-ui `DropdownMenu` from `@/components/ui/dropdown-menu`, `DropdownMenuCheckboxItem` already exists):
- Container `flex flex-col gap-2`.
- Selected chips: one chip per selected member (label = `member.userName || member.userEmail || member.userId`, matching the existing `label()` helper — keep it) with an X `Button` (`size="icon-xs"`, `variant="ghost"`) removing that id via `onChange(value.filter(v => v !== id))`. Chip shows a small avatar (decorative) + label.
- Trigger: `Button variant="outline" size="sm"` with `t("projects.tasks.addAssignee")`.
- Menu: one `DropdownMenuCheckboxItem` per member; `checked={value.includes(member.userId)}`; `onSelect` toggles the id in the array (order: keep member-list order — rebuild as `members.filter(m => next.includes(m.userId)).map(m => m.userId)`); item content = label + email (`text-xs text-muted-foreground`).
- Empty selection is valid (renders no chips; trigger still opens).

- [ ] **Step 2: Thread array state through the form**

- `task-form-details-step.tsx`: rename props `assigneeId: string` → `assigneeIds: string[]`, `onAssigneeChange: (value: string) => void` → `(value: string[]) => void`; pass through to `TaskAssigneeSelect`.
- `task-form.tsx`: `const [assigneeIds, setAssigneeIds] = useState<string[]>(() => task ? task.assignments.filter((a) => !isTerminalStatus(a.status)).map((a) => a.userId) : [])` (seed **open** assignments only — import `isTerminalStatus` from `@/lib/util/project-roles`). In `handleSubmit`, submit `assigneeIds` directly (drop the `assigneeId ? [assigneeId] : []` wrap).

- [ ] **Step 3: Passthrough in the store**

`stores/project-tasks/use-project-tasks-actions.ts`:
- `toTaskPayload` unchanged.
- `updateTask` gains optional `removedOpenAs?: "done" | "cancelled"` in its argument object; the `executeUpdate` call becomes `executeUpdate({ ...toTaskPayload(projectId, values), taskId, removedOpenAs })`.

- [ ] **Step 4: Unassign confirm flow in `tasks-card.tsx`**

Refactor `handleTaskSubmit` so the optimistic-row construction (lines 68–116) moves into a `buildOptimisticTask(data: TaskFormValues, editing: TaskWithAssignmentsDTO | undefined)` helper (same body). Then:

```ts
function handleTaskSubmit(data: TaskFormValues) {
  if (editingTask) {
    const openIds = editingTask.assignments
      .filter((a) => !isTerminalStatus(a.status)).map((a) => a.userId)
    const removed = openIds.filter((id) => !data.assigneeIds.includes(id))
    if (removed.length > 0) {
      setPendingUnassign({ data, optimisticTask: buildOptimisticTask(data, editingTask) })
      setUnassignOpen(true)          // TaskDialog stays open underneath
      return
    }
  }
  dispatchSubmit(data, undefined)     // existing close-dialogs + create/update behavior
}
```

- `dispatchSubmit(data, removedOpenAs)`: current close-dialogs + `createTask`/`updateTask` logic, passing `removedOpenAs` to `updateTask`.
- `confirmUnassign(disposition: "done" | "cancelled")`: `dispatchSubmit(pendingUnassign.data, disposition)`; clear both `unassignOpen` and `pendingUnassign`.
- Render `<ActionConfirmDialog open={unassignOpen} title={t("projects.tasks.unassign.title")} message={t("projects.tasks.unassign.message")} actions={[{ label: t("projects.tasks.unassign.markDone"), onClick: () => confirmUnassign("done"), variant: "default" }, { label: t("projects.tasks.unassign.markCancelled"), onClick: () => confirmUnassign("cancelled"), variant: "default" }]} onCancel={() => { setUnassignOpen(false); setPendingUnassign(null) }} />` — Cancel leaves the TaskDialog open with its state intact.
- Create path and edits with no open-assignment removals keep today's immediate-close behavior.

- [ ] **Step 5: Seed cleanup for the new spec**

In `lib/drizzle/seed-e2e.ts` `seedRolesProject()`, extend the wizard-gate cleanup `or(...)` with `like(tasksTable.name, "E2E multi%")` (assignments cascade on task delete).

- [ ] **Step 6: Write `e2e/multi-assignee.spec.ts` — tests 1 and 2**

Import from `./fixtures`. Constants: `PROJECT_ID`/`PROJECT_URL` as in the other specs. Date filling: mirror `task-wizard-validation.spec.ts` (`getByLabel("Fecha de inicio")` / `"Fecha de vencimiento"`, `toDateInput(new Date())` — **always today or future**, never past, or the predicate hides the row).

**Test 1 — "a task with several assignees shows counts, stack, and per-person rows":**
1. `signInAs("admin")` → `PROJECT_URL` → click `"Agregar Tarea"`.
2. Dialog: fill name `"E2E multi assign"` → `"Continuar"` → fill both dates with today → open the assignee menu (`"Agregar asignado"` button) → click `menuitemcheckbox` for `E2E Collaborator` → reopen menu → click for `user1@test.local` → `"Crear Tarea"`.
3. Main row `getByRole("row", { name: /E2E multi assign/ })`: contains `"2 open"`; contains no combobox (`expect(row.getByRole("combobox")).toHaveCount(0)`).
4. Expand via `"Detalles de asignados"` → sub-rows `/E2E Collaborator/` and `/user1@test.local/` each visible with one combobox; sub-row shows the email.
5. In the `E2E Collaborator` sub-row: combobox → `"Completado"` → toast `"Estado actualizado"` → counts now `"1 open"`; `E2E Collaborator` sub-row gone; `user1` sub-row still there.
6. Complete `user1@test.local` the same way → the whole row `/E2E multi assign/` disappears (`toHaveCount(0)`) — every assignment terminal leaves the list.

**Test 2 — "unassigning the last person asks what to do and leaves the task visible":**
1. Create `"E2E multi unassign"` with sole assignee `E2E Collaborator` (dates today).
2. Open the action menu (`Acciones para E2E multi unassign`) → `Editar E2E multi unassign` — the dialog opens on **step 1 (Details)**, where the assignee chips live → remove the chip via its X button → `"Continuar"` → `"Guardar cambios"`.
3. Confirm dialog visible with title `"¿Quitar asignado?"` → click `"Cancelar"` → confirm gone, **task dialog still visible** (assert its `"Programación"` step content or the `"Guardar cambios"` button is still there).
4. `"Guardar cambios"` again → confirm → click `"Marcar como cancelado"` → both dialogs close → row `/E2E multi unassign/` visible and shows `"Sin asignar"` (lingering: due today, nothing done).
5. History preserved: `signInAs("user2")` → `/app/mis-tareas` → tab `"Pasadas"` → row `/E2E multi unassign/` visible with `"Cancelado"` (the closed row was kept, not deleted).

- [ ] **Step 7: Run the new spec**

Run: `pnpm test:e2e -- multi-assignee.spec.ts`
Expected: PASS (both tests). If the stacked dialogs misbehave (focus/portal), fix in-session — this is Review Focus #1; do not weaken the test.

- [ ] **Step 8: Run full unit suite for regressions**

Run: `pnpm test:run`
Expected: PASS (form/store-related tests included).

- [ ] **Step 9: Ask the user to approve a commit**

---

### Task 7: People-tab removal confirmation

**Files:**
- Modify: `components/projects/project-people.tsx`
- Modify: `components/projects/member-pill.tsx` (optional `removeLabel` prop)
- Test: append test 3 to `e2e/multi-assignee.spec.ts`

**Interfaces:**
- Consumes: `DestructiveDialog` from `@/components/common/destructive-dialog` (existing, single confirm); `projects.removeMember.*` i18n keys (Task 4); `removeAdmin`/`removeCollaborator` from `useProjectPeopleActions` (unchanged — the server-side close came from Task 3).
- Produces: no new exports; `MemberPill` gains optional `removeLabel?: string` used as the remove button's `aria-label` (falls back to current `"Remove"`).

- [ ] **Step 1: Add pending-removal state + dialog to `project-people.tsx`**

```ts
const [pendingRemoval, setPendingRemoval] = useState<{
  userId: string; name: string; kind: "admin" | "collaborator"
} | null>(null)
```

Wire both pills' `onRemove` to `setPendingRemoval({ userId, name: member.userName || member.userEmail || "", kind })` (never call `removeAdmin`/`removeCollaborator` directly from the pill anymore). Render one `DestructiveDialog`:

- `open={pendingRemoval !== null}`
- `title={t("projects.removeMember.title")}`
- `message={t("projects.removeMember.message", { name: pendingRemoval?.name ?? "" })}`
- `confirmLabel={t("projects.removeMember.confirm")}`
- `onConfirm`: call `pendingRemoval.kind === "admin" ? removeAdmin : removeCollaborator` with `pendingRemoval.userId`, then `setPendingRemoval(null)`.
- `onCancel`: `setPendingRemoval(null)`.

Pass `removeLabel={t("projects.removeMember.removeButton", { name })}` to each `MemberPill` (add the optional prop in `member-pill.tsx`: `aria-label={removeLabel ?? "Remove"}`).

- [ ] **Step 2: Append e2e test 3 to `e2e/multi-assignee.spec.ts`**

**Test 3 — "removing a member cancels their open assignments":**
1. Create `"E2E multi member"` (admin, dates today) with sole assignee `user3@test.local`.
2. Goto `/app/proyectos/${PROJECT_ID}/personas` → pill containing `user3@test.local` → its button `getByRole("button", { name: "Eliminar a user3@test.local" })` → click.
3. Destructive dialog visible (`¿Eliminar miembro?`) → click `"Eliminar"` → dialog closes, pill gone.
4. Goto `PROJECT_URL` → row `/E2E multi member/` visible with `"Sin asignar"` (user3's open row was cancelled server-side; nothing done, due today → lingers).

- [ ] **Step 3: Run verification**

Run: `pnpm typecheck && pnpm eslint components/projects/project-people.tsx components/projects/member-pill.tsx && pnpm test:e2e -- multi-assignee.spec.ts`
Expected: PASS (all 3 tests).

- [ ] **Step 4: Ask the user to approve a commit**

---

### Task 8: Full verification + visual polish pass

**Files:** possibly cosmetic edits across Task 5/6 components (avatar stack, counts cell, expansion affordance, picker) driven by user feedback.

- [ ] **Step 1: Full verification**

Run: `pnpm verify`
Expected: typecheck + lint (0 warnings) + vitest coverage above floors (60/60/60, 50 branches).

- [ ] **Step 2: Full e2e**

Run: `pnpm test:e2e`
Expected: entire Playwright suite green (Docker test DB).

- [ ] **Step 3: Visual polish with the user**

Show the project task list (stack, counts, expansion, picker, dialogs) and iterate on presentation until the user is happy — functional behavior from the spec is fixed; only look-and-feel changes here. Re-run `pnpm verify` + `pnpm test:e2e` after any change.

- [ ] **Step 4: Final diff review + commit approval**

Review the full uncommitted diff with the user; commit only on explicit approval (pre-commit runs the full gate).
