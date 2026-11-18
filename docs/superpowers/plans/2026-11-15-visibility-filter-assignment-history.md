# Task Visibility Filter, Assignment History, and Assignment Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Both/Unfinished/Finished filter with read-only finished rows (reopen on non-repeating tasks, reassign via wizard everywhere), a paged closed-assignment history switch on expanded rows, a one-row-per-assignee assignment fetch backed by a new DB view, and transition/spawn rules that keep the one-open-per-assignee invariant unbreakable.

**Architecture:** Server: two view changes (new `task_assignment_latest` window view; `created_at` on `task_assignment_detail`), slimmed assignment reads, one new safe action (`getTaskAssignmentHistory`), and two rules in `updateAssignmentStatus` (repeat-task reopen ban; later-dated-row spawn guard). Client: filter + display rule + ordering as pure helpers in `lib/tasks/list.ts`, local filter state in `TasksCard`, a history panel component, and a spawn-replace in the project-tasks reducer. No route, store-shape, or predicate changes.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL (views via `pgView`), next-safe-action, Zod, next-intl (en/es), Zustand optimistic store, Vitest + `vitest-drizzle-mock`, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-11-15-finished-tasks-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Package manager is **pnpm**; never npm/yarn.
- **No commits, pushes, or PRs without explicit user permission (AGENTS.md).** Tasks end at verification; ask the user before committing anything.
- Never hand-edit `drizzle/` output — schema changes in `lib/drizzle/schema.ts` only, then `pnpm db:generate`.
- No `any`, no `eslint-disable`, no raw colors / manual `dark:` overrides (semantic tokens only).
- `messages/en.json` and `messages/es.json` stay structurally identical — every key added in task 8 exists in both files, and existing dynamic key-maps are never renamed.
- Filter and history state are **local component state only** — never in the store, never in the URL.
- Store invariant: `TaskWithAssignmentsDTO.assignments` holds exactly one row per assignee (open preferred, else latest closed).
- History page size is 10 (`HISTORY_PAGE_SIZE` in `actions/tasks/schemas.ts`).
- One component per file; event handlers of two or more lines memoized with `useCallback`.
- Verification commands: targeted `pnpm vitest run <file>`, `pnpm typecheck`, `pnpm eslint <paths>`, full `pnpm verify`, e2e `pnpm test:e2e` (Docker required).

## Review Focus

Inputs/failure modes no single task's happy path exercises; each line's test lives in the owning task:

1. **Reopening a closed row on a *repeating* task** must return `VALIDATION_FAILED` and change nothing — tested in task 3 (unit, `updateAssignmentStatus`).
2. **A closing row with a null due date** plus any dated row for the same assignee must not spawn (null sorts oldest) — tested in task 4 (unit, guard branch).
3. **A stale reopen racing an existing open row** (partial unique index violation) must surface as `VALIDATION_FAILED`, never a crash — tested in task 3 (unit, unique-violation mapping).
4. **History pagination past the end** must report `hasMore: false` and return the coerced page — tested in task 5 (unit, limit+1 math and date coercion).
5. **Filter survival across mutations**: creating/editing while on Finished must not flip the filter, and the Finished empty state must be its own copy — tested in task 10 (e2e).

---

### Task 1: DB views — `created_at` on the detail view, new `task_assignment_latest`

**Files:**
- Modify: `lib/drizzle/schema.ts:543-567` (detail view) and append after it
- Test: `lib/drizzle/schema.test.ts`

**Interfaces:**
- Consumes: `taskAssignmentDetailView` (existing, columns aliased `assignment_id`, `task_id`, `user_id`, `status`, `comment`, `start_date`, `end_date`, `user_name`, `user_email`, `user_image`, …).
- Produces: `export const taskAssignmentLatestView = pgView("task_assignment_latest")` with the **same column names as the detail view** (minus task fields), one row per `(task_id, user_id)`; `taskAssignmentDetailView.createdAt` (`created_at`). Task 2 selects from both.

- [ ] **Step 1: Write the failing test**

In `lib/drizzle/schema.test.ts`, beside the existing `expect(taskAssignmentDetailView).toBeDefined()`:

```ts
expect(taskAssignmentLatestView).toBeDefined()
```

(import it from `@/lib/drizzle/schema`). Also assert the detail view gained its column: `expect(taskAssignmentDetailView.createdAt).toBeDefined()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/drizzle/schema.test.ts`
Expected: FAIL — `taskAssignmentLatestView` is not exported (TS/import error).

- [ ] **Step 3: Implement the schema changes**

In `lib/drizzle/schema.ts`:

1. On `taskAssignmentDetailView` (inside the `.select({...})`), add:
   `createdAt: sql<Date>`${taskAssignmentsTable.createdAt}`.as("created_at")`.
2. Add after the detail view:

```ts
export const taskAssignmentLatestView = pgView("task_assignment_latest").as(
  (qb) => {
    const numbered = qb
      .select({
        assignmentId: taskAssignmentDetailView.assignmentId,
        taskId: taskAssignmentDetailView.taskId,
        userId: taskAssignmentDetailView.userId,
        status: taskAssignmentDetailView.status,
        comment: taskAssignmentDetailView.comment,
        startDate: taskAssignmentDetailView.startDate,
        endDate: taskAssignmentDetailView.endDate,
        userName: taskAssignmentDetailView.userName,
        userEmail: taskAssignmentDetailView.userEmail,
        userImage: taskAssignmentDetailView.userImage,
        rn: sql<number>`row_number() over (
          partition by ${taskAssignmentDetailView.taskId}, ${taskAssignmentDetailView.userId}
          order by (case when ${taskAssignmentDetailView.status} in ('done','cancelled') then 1 else 0 end) asc,
                   ${taskAssignmentDetailView.startDate} desc nulls last
        )`.as("rn"),
      })
      .from(taskAssignmentDetailView)
      .as("numbered")
    return qb
      .select({
        assignmentId: numbered.assignmentId,
        taskId: numbered.taskId,
        userId: numbered.userId,
        status: numbered.status,
        comment: numbered.comment,
        startDate: numbered.startDate,
        endDate: numbered.endDate,
        userName: numbered.userName,
        userEmail: numbered.userEmail,
        userImage: numbered.userImage,
      })
      .from(numbered)
      .where(eq(numbered.rn, 1))
  }
)
```

Ordering mirrors `isNewerAssignment` (`components/projects/tasks-table.tsx:50-64`): open rows rank before terminal, later `start_date` wins, null `start_date` is oldest (`desc nulls last`). Add `eq` to the `drizzle-orm` import in `schema.ts` if missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/drizzle/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate and apply the migration**

Run: `pnpm db:generate`, review the generated `drizzle/*.sql` (must contain `CREATE VIEW task_assignment_latest` with the window function and an `ALTER`/recreate adding `created_at` to `task_assignment_detail`), then `pnpm db:migrate`.
Expected: migration applies cleanly; no manual edits to `drizzle/`.

---

### Task 2: Slim assignment reads through the latest view

**Files:**
- Modify: `actions/tasks/queries.ts:39-50, 102-114`
- Test: `actions/tasks/tasks.test.ts` (mock tokens in the `getTasks`, `createTask`, `updateTask` describes)

**Interfaces:**
- Consumes: `taskAssignmentLatestView` (task 1).
- Produces: unchanged signatures — `getTasksWithAssignments(projectId)`, `getTaskWithAssignments(taskId)` now return rows picked by the view (one row per assignee). No consumer changes.

- [ ] **Step 1: Write the failing test**

There is no new behavior to assert — the view guarantees what the client deduped. Instead, run the existing suite as the failing signal for the token swap:

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: currently PASS (nothing changed yet) — this is the baseline you must keep green.

- [ ] **Step 2: Point the two reads at the latest view**

In `actions/tasks/queries.ts`:
1. Import `taskAssignmentLatestView` alongside `taskAssignmentDetailView`.
2. Add `const LATEST_ASSIGNMENT_COLUMNS = { ... }` with the same ten keys as `ASSIGNMENT_VIEW_COLUMNS` that `toTaskAssignmentDTO` needs (`assignmentId, taskId, userId, status, comment, startDate, endDate, userName, userEmail, userImage`), each referencing `taskAssignmentLatestView.<field>`.
3. In `getAssignmentRowsByTaskIds` and `getAssignmentRowsByTaskId`, switch `.from(taskAssignmentDetailView)` → `.from(taskAssignmentLatestView)` and the column map → `LATEST_ASSIGNMENT_COLUMNS`.

Leave `getAssignmentViewById` (used by `updateAssignmentStatus` reload) on the detail view.

- [ ] **Step 3: Fix the mocks the swap breaks and run**

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: failures wherever a mock feeds `getAssignmentRowsByTaskIds`/`getAssignmentRowsByTaskId` (the `getTasks`/`createTask`/`updateTask` describes) — swap those `.onSelect(schema.taskAssignmentDetailView)` registrations to `.onSelect(schema.taskAssignmentLatestView)`. Do **not** touch mocks feeding `getAssignmentViewById` (status/comment describes). Re-run until PASS.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm eslint actions/tasks/queries.ts actions/tasks/tasks.test.ts`
Expected: clean.

---

### Task 3: Transition rules — repeat-task reopen ban

**Files:**
- Modify: `actions/tasks/actions.ts:150-164` (manager branch + comment)
- Test: `actions/tasks/tasks.test.ts` (`updateAssignmentStatus` describe)

**Interfaces:**
- Consumes: `queries.getAssignmentForRow` (already returns `recurrence`), `isTerminalStatus`, `returnActionError`, `isUniqueViolation` (existing).
- Produces: server rule — manager + terminal row + open target status + `row.recurrence` set → `VALIDATION_FAILED`. Non-repeating reopen allowed. No client change (UI gating is task 9).

- [ ] **Step 1: Write the failing tests**

Append to the `updateAssignmentStatus` describe in `actions/tasks/tasks.test.ts`, mirroring the existing mock style (a `taskAssignmentsTable` row for `getAssignmentForRow`, `onUpdate` + detail-view mocks for the success path):

```ts
it("rejects reopening a closed assignment on a repeating task", async () => {
  state.mock.onSelect(schema.taskAssignmentsTable).respond([
    { id: ASSIGNMENT_ID, userId: USER_ID, status: "done", endDate: new Date("2026-11-10T11:00:00"),
      taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
      startTime: "09:00", endTime: "11:00" },
  ])
  const result = await updateAssignmentStatus({
    projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
  })
  expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
})

it("lets a manager reopen a closed assignment on a non-repeating task", async () => {
  state.mock.onSelect(schema.taskAssignmentsTable).respond([
    { id: ASSIGNMENT_ID, userId: USER_ID, status: "cancelled", endDate: new Date("2026-11-10T11:00:00"),
      taskId: TASK_ID, recurrence: null, interval: 1, daysOfWeek: null,
      startTime: null, endTime: null },
  ])
  state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
  state.mock.onSelect(schema.taskAssignmentDetailView)
    .respond([makeAssignmentRow({ status: "todo" })])
  const result = await updateAssignmentStatus({
    projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
  })
  expect(result.serverError).toBeUndefined()
  expect(result.data?.assignment.status).toBe("todo")
  expect(result.data?.nextAssignment).toBeNull()
})

it("maps a reopen that races an existing open row to VALIDATION_FAILED", async () => {
  state.mock.onSelect(schema.taskAssignmentsTable).respond([
    { id: ASSIGNMENT_ID, userId: USER_ID, status: "done", endDate: new Date("2026-11-10T11:00:00"),
      taskId: TASK_ID, recurrence: null, interval: 1, daysOfWeek: null,
      startTime: null, endTime: null },
  ])
  state.mock.onUpdate(schema.taskAssignmentsTable)
    .throw(Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }))
  const result = await updateAssignmentStatus({
    projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "todo",
  })
  expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
})
```

(If `isUniqueViolation` in `actions/tasks/util.ts` reads a different field than `code`, shape the error to match it.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "updateAssignmentStatus"`
Expected: first test FAILS (repeating reopen currently succeeds), the other two PASS already (non-repeating reopen and unique mapping exist today) — keep them as regression pins.

- [ ] **Step 3: Implement the rule**

In `actions/tasks/actions.ts`, extend the manager branch after the existing `ALL_TASK_STATUSES` check (`:150-154`):

```ts
} else if (
  isTerminalStatus(row.status) &&
  !isTerminalStatus(status as TaskStatus) &&
  row.recurrence
) {
  // Repeat chains can't be reopened — terminal→open exists only on
  // non-repeating tasks, so history can never fork a successor.
  returnActionError("VALIDATION_FAILED")
}
```

Rewrite the comment at `:156-160` to match: repeat tasks reject reopen at the rule above; non-repeating reopen never spawns; the unique-violation catch guards spawn races and stale reopens.

- [ ] **Step 4: Run the full file**

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: PASS — if any pre-existing test expected reopen on a repeating task, update it per this rule (that expectation is what task 3 supersedes).

---

### Task 4: Spawn guard — later-dated assignment blocks spawn

**Files:**
- Modify: `actions/tasks/queries.ts` (new leaf query + export block `:749-774`), `actions/tasks/actions.ts:172-192`
- Test: `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `queries.getAssignmentForRow` row (`taskId`, `userId`, `endDate`, `recurrence`).
- Produces: `hasLaterDatedAssignment(taskId: string, userId: string, endDate: Date | null): Promise<boolean>` on the default `queries` object. Called only from `updateAssignmentStatus` when `crossesToTerminal && row.recurrence`.

- [ ] **Step 1: Write the failing tests**

```ts
it("does not spawn when a later-dated assignment exists for the assignee", async () => {
  state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) =>
    sql.includes("exists") ? [{ id: "later-row" }] : [
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: new Date("2026-11-10T11:00:00"),
        taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
        startTime: "09:00", endTime: "11:00" },
    ]
  )
  state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
  state.mock.onSelect(schema.taskAssignmentDetailView)
    .respond([makeAssignmentRow({ status: "done" })])

  const result = await updateAssignmentStatus({
    projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
  })
  expect(result.serverError).toBeUndefined()
  expect(result.data?.nextAssignment).toBeNull()
})

it("treats a null closing due date as oldest, so any dated row blocks the spawn", async () => {
  state.mock.onSelect(schema.taskAssignmentsTable).respondWith((sql) =>
    sql.includes("exists") ? [{ id: "dated-row" }] : [
      { id: ASSIGNMENT_ID, userId: USER_ID, status: "todo", endDate: null,
        taskId: TASK_ID, recurrence: "daily", interval: 1, daysOfWeek: null,
        startTime: "09:00", endTime: "11:00" },
    ]
  )
  state.mock.onUpdate(schema.taskAssignmentsTable).respond([])
  state.mock.onSelect(schema.taskAssignmentDetailView)
    .respond([makeAssignmentRow({ status: "done" })])

  const result = await updateAssignmentStatus({
    projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done",
  })
  expect(result.data?.nextAssignment).toBeNull()
})
```

Routing note: `getAssignmentForRow` and the guard both select `taskAssignmentsTable`; `respondWith` branches on the SQL text (the guard wraps an `exists (...)`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "spawn"`
Expected: the two new tests FAIL (`hasLaterDatedAssignment` undefined); the existing spawn-success test currently PASSES.

- [ ] **Step 3: Implement the query and wire the guard**

In `actions/tasks/queries.ts` — new leaf next to `getOpenAssignments`:

```ts
async function hasLaterDatedAssignment(
  taskId: string, userId: string, endDate: Date | null
): Promise<boolean>
```

`SELECT EXISTS` over `taskAssignmentsTable` where `task_id`/`user_id` match and `end_date > <endDate>`; when `endDate` is `null`, the comparison is simply `end_date IS NOT NULL` (null sorts oldest — any dated row is later). Add it to the `queries` default export.

In `actions/tasks/actions.ts`, restructure the spawn block (`:172-192`): inside `if (crossesToTerminal && row.recurrence)`, first `const laterExists = await queries.hasLaterDatedAssignment(row.taskId, row.userId, row.endDate)`; only when it is `false`, run the existing `computeNextOccurrence`/spawn assignment. The status write is unchanged.

- [ ] **Step 4: Run tests and keep the spawn-success case honest**

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: new tests PASS; if the pre-existing spawn-success test(s) now fail because the guard's `EXISTS` consumed the row mock, convert their `onSelect(taskAssignmentsTable).respond([row])` to `respondWith((sql) => sql.includes("exists") ? [] : [row])` so the guard sees no later row. Re-run until PASS.

---

### Task 5: `getTaskAssignmentHistory` — query, action, barrel

**Files:**
- Modify: `actions/tasks/schemas.ts`, `actions/tasks/queries.ts` (+ export block), `actions/tasks/actions.ts`, `actions/tasks/index.ts`
- Test: `actions/tasks/tasks.test.ts` (new `getTaskAssignmentHistory` describe)

**Interfaces:**
- Consumes: `taskAssignmentDetailView.createdAt` (task 1), `projectAction`, `canViewProject`, `toTaskAssignmentDTO`.
- Produces (consumed by tasks 9):
  - `TaskAssignmentHistorySchema` = `{ projectId: uuid, taskId: uuid, limit: int min 1 max 50, offset: int min 0 }`
  - `TaskAssignmentHistoryResultSchema` = `{ assignments: TaskAssignmentSchema[], hasMore: boolean }`, type `TaskAssignmentHistoryDTO`
  - `HISTORY_PAGE_SIZE = 10` (exported const in `schemas.ts`)
  - `export const getTaskAssignmentHistory` in `actions.ts` + re-export from `index.ts`
  - `queries.getTaskAssignmentHistory(taskId, limit, offset)`

- [ ] **Step 1: Write the failing tests**

New describe in `actions/tasks/tasks.test.ts`:

```ts
describe("getTaskAssignmentHistory", () => {
  it("pages closed assignments and reports hasMore", async () => {
    grantAccess("owner")  // or the existing access helper used by getTasks tests
    state.mock.onSelect(schema.taskAssignmentDetailView).respond(
      Array.from({ length: 11 }, (_, i) =>
        makeAssignmentRow({ assignmentId: `h${i}`, status: i % 2 ? "cancelled" : "done" })
      )
    )
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID, taskId: TASK_ID, limit: 10, offset: 0,
    })
    expect(result.data?.assignments).toHaveLength(10)
    expect(result.data?.hasMore).toBe(true)
    // ordering lives in SQL: assert the recorded select orders by created_at
    expect(state.mock.calls.some(([sql]) => sql.includes("created_at"))).toBe(true)
  })

  it("coerces view date strings and reports hasMore false when the page fits", async () => {
    grantAccess("owner")
    state.mock.onSelect(schema.taskAssignmentDetailView).respond([
      makeAssignmentRow({ assignmentId: "h0", status: "done" }),
      makeAssignmentRow({ assignmentId: "h1", status: "cancelled" }),
    ])
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID, taskId: TASK_ID, limit: 10, offset: 0,
    })
    expect(result.data?.hasMore).toBe(false)
    expect(result.data?.assignments[0]?.startDate).toBeInstanceOf(Date)
  })

  it("forbids a caller without project access", async () => {
    const result = await getTaskAssignmentHistory({
      projectId: PROJECT_ID, taskId: TASK_ID, limit: 10, offset: 0,
    })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})
```

Mirror however the existing `getTasks` describe grants/omits access (`grantAccess` helper vs default state).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "getTaskAssignmentHistory"`
Expected: FAIL — action not exported.

- [ ] **Step 3: Implement**

1. `schemas.ts`: `HISTORY_PAGE_SIZE = 10`, `TaskAssignmentHistorySchema`, `TaskAssignmentHistoryResultSchema` (`z.object({ assignments: z.array(TaskAssignmentSchema), hasMore: z.boolean() })`), type `TaskAssignmentHistoryDTO`.
2. `queries.ts`: `getTaskAssignmentHistory(taskId: string, limit: number, offset: number)` — select `ASSIGNMENT_VIEW_COLUMNS` from `taskAssignmentDetailView` where `taskId` matches and `status` in `["done", "cancelled"]`, `orderBy desc(taskAssignmentDetailView.createdAt)`, fetch `limit + 1` rows, `hasMore = rows.length > limit`, slice to `limit`, map with `toTaskAssignmentDTO`. Add to the `queries` export object.
3. `actions.ts`:

```ts
export const getTaskAssignmentHistory = projectAction(TaskAssignmentHistorySchema)
  .metadata({})
  .outputSchema(TaskAssignmentHistoryResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) returnActionError("FORBIDDEN")
    return queries.getTaskAssignmentHistory(parsedInput.taskId, parsedInput.limit, parsedInput.offset)
  })
```

4. `index.ts`: add `getTaskAssignmentHistory` to the named re-export list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts`
Expected: PASS.

---

### Task 6: Store — spawn commit replaces the closed row

**Files:**
- Modify: `stores/project-tasks/project-tasks-reducer.ts:132-157`
- Test: `stores/project-tasks/project-tasks-store.test.ts:139-162`

**Interfaces:**
- Consumes: `upsertAssignment` action shape `{ taskId, assignment, nextAssignment? }` (unchanged).
- Produces: after a commit with `nextAssignment`, the assignee's row set contains only the open successor — the one-row-per-assignee invariant survives spawns. Consumers: task 9's display rule, which assumes one row per user.

- [ ] **Step 1: Rewrite the failing test**

Replace the test at `project-tasks-store.test.ts:139` — rename it `"replaces the closed row with the spawned occurrence so each assignee keeps one row"` and change the final assertion from

```ts
).toEqual(["assignment-2", "assignment-1"])
```

to

```ts
).toEqual(["assignment-2"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run stores/project-tasks/project-tasks-store.test.ts`
Expected: FAIL — actual `["assignment-2", "assignment-1"]`.

- [ ] **Step 3: Implement the reducer branch**

In `projectTasksReducer`'s `upsertAssignment` case, after the existing upsert of `action.assignment`: when `action.nextAssignment` is present, filter out every row whose `userId` equals `nextAssignment.userId` (except the next row itself), then append `nextAssignment` if absent, then `sortAssignments`. Without `nextAssignment`, behavior is unchanged.

- [ ] **Step 4: Run store tests**

Run: `pnpm vitest run stores/project-tasks/`
Expected: PASS (all other store tests unaffected — none assert two rows per user).

---

### Task 7: Pure helpers — display rule and ordering

**Files:**
- Create: `lib/tasks/list.ts`, `lib/tasks/list.test.ts`
- Modify: `lib/tasks/filter.test.ts` (one added case)

**Interfaces:**
- Consumes: `shouldShowTask`, `isOpenAssignment` from `lib/tasks/filter.ts`; `TaskAssignmentDTO`, `TaskWithAssignmentsDTO` from `@/actions/tasks/schemas`.
- Produces (consumed by tasks 8–9):
  - `export type TasksVisibilityFilter = "unfinished" | "both" | "finished"`
  - `export function visibleAssignments(assignments: TaskAssignmentDTO[]): TaskAssignmentDTO[]`
  - `export function selectTasks(tasks: TaskWithAssignmentsDTO[], filter: TasksVisibilityFilter, now: Date): TaskWithAssignmentsDTO[]`

- [ ] **Step 1: Write the failing tests**

`lib/tasks/list.test.ts` (fixture style mirrors `lib/tasks/filter.test.ts`):

```ts
describe("visibleAssignments", () => {
  it("shows only open rows when the task has any open assignment", () => {
    const open = makeAssignment({ id: "a1", userId: "u1", status: "todo" })
    const closed = makeAssignment({ id: "a2", userId: "u2", status: "done" })
    expect(visibleAssignments([open, closed])).toEqual([open])
  })
  it("shows every row when the task has no open assignment", () => {
    const rows = [makeAssignment({ id: "a1", userId: "u1", status: "done" }),
                  makeAssignment({ id: "a2", userId: "u2", status: "cancelled" })]
    expect(visibleAssignments(rows)).toEqual(rows)
  })
})

describe("selectTasks", () => {
  it("unfinished filters to shouldShowTask and orders by due date ascending, nulls last", () => { /* two visible tasks, one null due */ })
  it("finished filters to the complement and orders by due date descending, nulls last", () => { /* ... */ })
  it("both lists unfinished tasks before finished ones", () => { /* ... */ })
})
```

Fill the `/* ... */` bodies with concrete rows: build `TaskWithAssignmentsDTO` fixtures with `endDate` values and assert `selectTasks(...).map((t) => t.id)` orderings exactly. Add to `lib/tasks/filter.test.ts`:

```ts
  it("keeps a task visible when every slim row is cancelled and the due date is valid (slim-input edge)", () => {
    // Build the assignment row with the same fixture helper the file
    // already uses (no casts): status "cancelled", endDate null; task
    // endDate in the future.
    expect(shouldShowTask({ assignments: [cancelledRow], endDate: nextWeek }, now)).toBe(true)
  })
```

(no `any` in shipped code — use the same fixture shape the file already builds for assignments.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run lib/tasks/`
Expected: FAIL — `lib/tasks/list.ts` does not exist.

- [ ] **Step 3: Implement `lib/tasks/list.ts`**

- `visibleAssignments`: `assignments.some(isOpenAssignment) ? assignments.filter(isOpenAssignment) : assignments` (the store's one-row-per-assignee invariant makes the else branch the per-assignee last-finished set).
- `selectTasks`:
  - `"unfinished"` → `tasks.filter((t) => shouldShowTask(t, now))`, ordered by `endDate` ascending, `null` last;
  - `"finished"` → complement, ordered by `endDate` descending, `null` last;
  - `"both"` → unfinished list (asc) concatenated before finished list (desc).
  - Pure, no store access; `now` is a parameter so tests pin the boundary.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run lib/tasks/`
Expected: PASS.

---

### Task 8: Filter UI + i18n + TasksCard wiring

**Files:**
- Create: `components/projects/tasks-filter.tsx`
- Modify: `components/projects/tasks-card.tsx:41-52, 144-187`, `messages/en.json`, `messages/es.json`
- Test: covered by task 10's e2e; typecheck/lint here

**Interfaces:**
- Consumes: `TasksVisibilityFilter`, `selectTasks` from `@/lib/tasks/list`.
- Produces: `<TasksFilter value={TasksVisibilityFilter} onChange={(v) => void} />`.

- [ ] **Step 1: Add the translation keys**

Both `messages/en.json` and `messages/es.json`, under `projects.tasks` (and `common` for loadMore) — values verbatim from the spec's table (spec §#11): `both` "Both"/"Ambas", `unfinished` "Unfinished"/"Sin finalizar", `finished` "Finished"/"Finalizadas", `noFinished` "No finished tasks yet"/"Aún no hay tareas finalizadas", `reopen` "Reopen"/"Reabrir", `showClosed` "Show closed assignments"/"Mostrar asignaciones cerradas", `common.loadMore` "Load more"/"Cargar más". Reuse `projects.tasks.noTasks` as the empty copy for Unfinished and Both.

- [ ] **Step 2: Implement `components/projects/tasks-filter.tsx`**

A pill group (mirroring the muted segmented styling in `components/projects/project-view.tsx:96-118`): three buttons labeled `t("projects.tasks.unfinished")`, `t("projects.tasks.both")`, `t("projects.tasks.finished")`, each `aria-pressed={value === <key>}`, `onClick={() => onChange(<key>)}`. Export the component and nothing else (the `TasksVisibilityFilter` type comes from `@/lib/tasks/list`).

- [ ] **Step 3: Wire `TasksCard`**

- Add `const [filter, setFilter] = useState<TasksVisibilityFilter>("unfinished")`.
- Replace the `visibleTasks` computation with `const visibleTasks = selectTasks(tasks, filter, new Date())`.
- In the header (`:147-157`), render `<TasksFilter value={filter} onChange={setFilter} />` between the title span and the Add Task button.
- Empty state (`:161-164`): when `visibleTasks.length === 0`, show `t("projects.tasks.noFinished")` if `filter === "finished"`, else `t("projects.tasks.noTasks")`.
- Keep all `TasksTable` props as-is (no `onReopen` prop needed — reopen rides `onStatusChange`, see task 9).

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm eslint components/projects/tasks-filter.tsx components/projects/tasks-card.tsx`
Expected: clean. (Behavior proven in task 10.)

---

### Task 9: Table — display rule, history switch, reopen control

**Files:**
- Modify: `components/projects/tasks-table.tsx` (remove `:50-80` helpers, rewire `:127-278`), `components/projects/task-assignment-rows.tsx`, `stores/project-tasks/use-project-tasks-actions.ts`
- Create: `components/projects/task-history-panel.tsx`
- Test: covered by task 10's e2e; typecheck/lint here

**Interfaces:**
- Consumes: `visibleAssignments` from `@/lib/tasks/list`; `HISTORY_PAGE_SIZE`, `TaskAssignmentHistoryDTO`, `getTaskAssignmentHistory` (task 5); `updateAssignmentStatus` action (existing, for reopen with `"todo"`); `useProjectContextState` (for `projectId`).
- Produces:
  - `TaskAssignmentRows` props gain optional `recurrence?: string | null` and `onReopen?: (assignmentId: string) => void`.
  - `<TaskHistoryPanel taskId={string} />` — self-fetching read-only history.
  - `useProjectTasksActions().loadAssignmentHistory(projectId: string, taskId: string, offset: number): Promise<TaskAssignmentHistoryDTO | null>`.

- [ ] **Step 1: Slim the table to the display rule**

In `tasks-table.tsx`: delete `startDateValue`, `isNewerAssignment`, and `latestAssignmentPerUser`; import `visibleAssignments`. In the row map, `const shown = visibleAssignments(task.assignments)`; use `shown` for the chevron condition (`:168`), the assignee stack (`:210-213`), and the expanded `TaskAssignmentRows` (`:273-276`). Keep `open`/`counts` computed from open rows exactly as today.

- [ ] **Step 2: Reopen control in `task-assignment-rows.tsx`**

- Props interface: add `recurrence?: string | null` and `onReopen?: (assignmentId: string) => void`.
- In the badge branch (`:113-117`), after the `<Badge>`, render when `onReopen && (isOwner || isAdmin) && !recurrence`:

```tsx
<Button variant="outline" size="sm" onClick={() => onReopen(assignment.id)}>
  {t("projects.tasks.reopen")}
</Button>
```

- History mode passes no `onReopen`, so history rows stay read-only automatically. Terminal rows never render a select (existing `allowed = null` path — unchanged).

- [ ] **Step 3: `loadAssignmentHistory` in the actions hook**

In `use-project-tasks-actions.ts`: register `const { executeAsync: executeHistory } = useAction(getTaskAssignmentHistory)` (imported from `@/actions/tasks`), import `HISTORY_PAGE_SIZE` and `type TaskAssignmentHistoryDTO` from `@/actions/tasks/schemas`, and add:

```ts
const loadAssignmentHistory = useCallback(
  async (projectId: string, taskId: string, offset: number): Promise<TaskAssignmentHistoryDTO | null> => {
    const result = await executeHistory({ projectId, taskId, limit: HISTORY_PAGE_SIZE, offset })
    return result.data ?? null
  },
  [executeHistory]
)
```

Add it to the returned object. (A read that returns a page — no store pend, no toast; the panel handles its own loading state.)

- [ ] **Step 4: `task-history-panel.tsx`**

```tsx
props: { taskId: string }
```

Local state: `rows: TaskAssignmentDTO[]`, `hasMore: boolean`, `loading: boolean`. On mount (`useEffect`), fetch offset `0`; a Load More button (`t("common.loadMore")`, `disabled={loading}`) appends offset `rows.length`. Render `<TaskAssignmentRows taskId={taskId} assignments={rows} onStatusChange={() => {}} />` — no `onReopen`, no `recurrence` → fully read-only. Take `projectId` from `useProjectContextState()`.

- [ ] **Step 5: History switch in `tasks-table.tsx`**

Add `const [historyOpen, setHistoryOpen] = useState<Set<string>>(new Set())` beside `expanded` (mirror `toggleExpanded`). In the expanded block: a toggle button labeled `t("projects.tasks.showClosed")` with `aria-pressed={historyOpen.has(task.id)}`; when pressed, render `<TaskHistoryPanel taskId={task.id} />` **instead of** `TaskAssignmentRows`, otherwise the rows with `recurrence={task.recurrence}` and

```tsx
onReopen={(assignmentId) => onStatusChange(task.id, assignmentId, "todo")}
```

The existing `onStatusChange` prop already calls `updateAssignmentStatus(projectId, taskId, assignmentId, status)` in `TasksCard` — reopen needs no new wiring, and the server rule (task 3) is what rejects repeating tasks.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm eslint components/projects stores/project-tasks`
Expected: clean. (Behavior proven in task 10.)

---

### Task 10: E2E — filter, reopen, display rule, history

**Files:**
- Create: `e2e/task-filter.spec.ts`
- Existing specs must keep passing: `e2e/multi-assignee.spec.ts`, `e2e/repeating-tasks.spec.ts`, `e2e/task-assignments.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`signInAs` from `./fixtures`; the UI flows from tasks 8–9. UI strings are Spanish in e2e (mirror `multi-assignee.spec.ts` selectors: "Finalizadas", "Sin finalizar", "Ambas", "Reabrir", "Mostrar asignaciones cerradas", "Cargar más").

- [ ] **Step 1: Write the spec**

`e2e/task-filter.spec.ts` — mirror the project/task creation setup from `e2e/multi-assignee.spec.ts`, then:

1. **Finished filter + reopen (non-repeating):** create a non-repeating task with an assignee → mark it done (row leaves the default Unfinished list) → click "Finalizadas" → row present, expanded rows show badges and a "Reabrir" button, and **no** status select (combobox) → click "Reabrir" → row disappears from Finished (filter stays pressed — no auto-flip) → click "Sin finalizar" → row is back with an open status control.
2. **Repeating finished task has no reopen:** repeating task with all assignments closed via the wizard ("Marcar como cancelado") → "Finalizadas" → row present, expanded rows have badges but **no** "Reabrir" button (wizard Edit still available via the action menu).
3. **No auto-flip on reassign:** while on "Finalizadas", open Edit on a finished task, reassign a member, save → still on "Finalizadas" (aria-pressed true), task absent → switch to "Sin finalizar" → present.
4. **Ordering in Both:** three tasks — unfinished due tomorrow, unfinished due in three days, finished — click "Ambas" → row order is tomorrow-unfinished, three-days-unfinished, finished (`nth()` on rows by name text).
5. **Display rule + history:** mixed task (one open, one done assignee) → expand → only the open assignee appears in the rows → click "Mostrar asignaciones cerradas" → the done assignee's row appears with a badge and no combobox → rows are the server history (read-only). Load More boundary: on a daily repeating task, close its open occurrence 11 times via the status select (each close spawns the next) → expand → Show closed → 10 rows + "Cargar más" visible → click → 11th row appended, button gone (`hasMore: false`).
6. **Removed then reassigned:** on a non-repeating task, remove the assignee through the wizard ("Marcar como cancelado") → task shows as "Sin asignar" (unfinished, zero open) with a "Reabrir" button; reassign the same member via Edit → task back with their open row and the old closed row only behind "Mostrar asignaciones cerradas".
7. **Empty Finished state:** a project with no finished tasks → "Finalizadas" → "Aún no hay tareas finalizadas".

- [ ] **Step 2: Run the new spec**

Run: `pnpm test:e2e -- e2e/task-filter.spec.ts` (or the repo's Playwright filter equivalent; requires Docker test DB on port 3100)
Expected: PASS. Fix selectors/plumbing only — not product behavior; a product failure goes back to the owning task.

- [ ] **Step 3: Full gates**

Run: `pnpm verify` then `pnpm test:e2e`
Expected: typecheck + eslint (0 warnings) + vitest with coverage floors (60% lines/functions/statements, 50% branches) + the whole Playwright suite green — including the pre-existing `multi-assignee` pins.

- [ ] **Step 4: Report and request commit permission**

Summarize changed files and test results to the user and **ask before committing** (AGENTS.md).
