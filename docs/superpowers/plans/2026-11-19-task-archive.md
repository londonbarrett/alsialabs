# Task Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit archiving to project tasks — an Open/Archived filter, Archive/Unarchive menu actions with a confirm dialog, a server-side freeze on archived tasks, and one recurrence-checked spawn helper shared by four triggers (unarchive, due-date change, assignment close, add-assignee) backed by a new `task_assignee` membership table.

**Architecture:** `task.archived` partitions the list; `task_assignee` is the source of truth for *who is assigned* (hard-deleted on unassign, distinct from terminal assignment history). All write logic stays in `actions/tasks/queries.ts`; `actions/tasks/actions.ts` only guards permissions/freeze and orchestrates. A single composed query `spawnEligibleAssignments` reads the task roster and open rows, uses the pure `computeNextOccurrence` for the range check, and inserts open assignments through one leaf write; its optional `client` parameter lets callers enlist it in their own transaction. The optimistic store mirrors archive/unarchive via one `setArchived` reducer case; `router.refresh()` in `useOptimisticAction` re-seeds server truth (including healed/spawned rows) after every mutation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Drizzle ORM + PostgreSQL, next-safe-action, Zod 4, Zustand optimistic stores, next-intl, Vitest + vitest-drizzle-mock, Playwright. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-11-19-task-archive-design.md` (approved, currently uncommitted — commit it with Task 1 so the plan and spec travel together).

## Global Constraints

- No data migration: local `task`, `task_assignment`, and `task_assignee` tables are truncated. `archived` defaults to `false`; membership rows are created fresh. (`spec`, Non-goals / #1)
- Generate SQL with `pnpm db:generate`; never hand-edit `drizzle/*.sql`, `drizzle/meta/_journal.json`, or `drizzle/meta/*_snapshot.json`. Apply with `pnpm db:migrate` (test DB: `pnpm test:db:migrate`). (`spec`, #1/#2)
- Archived tasks are **completely frozen**: every task/assignment/comment mutation rejects while `archived = true`; only `unarchiveTask` and `deleteTask` are exceptions. No hidden UI is the only gate. (`spec`, Goals / #6)
- Spawn rule 0: an archived task opens assignments under no circumstance — the helper checks `archived` first. (`spec`, #7)
- The filter has exactly two options, `"open" | "archived"`, partitioning on `task.archived`; no auto-flip, no URL/store persistence, no count badges, no "archived" status badge. (`spec`, Goals / #3)
- Non-repeating tasks never gain assignments from a date edit or unarchive. Removing an assignee hard-deletes only that task's `task_assignee` row; `task_assignment` history is never deleted. (`spec`, Non-goals / #2)
- `messages/en.json` and `messages/es.json` stay structurally identical; dynamic key maps (`errors.*`, `projects.tasks.status.*`, etc.) are never renamed or merged. (`spec`, #10 / AGENTS.md)
- Calendar and My Tasks are untouched. The close-time spawn keeps the 2026-11-15 guards (open→terminal, recurrence, `computeNextOccurrence` range, `hasLaterDatedAssignment`) with the closing row's date as anchor. (`spec`, #7 / 2026-11-15 spec #9)
- Server-action layout: `"use server"` only on `actions/tasks/actions.ts`; barrel re-exports from `./actions` without the directive; each leaf query is exactly one DB call, composed queries call other queries; every action declares `.inputSchema()` and `.outputSchema()`; consumers infer DTOs from `schemas.ts`. (AGENTS.md)
- One component per file; handlers of two lines or more are memoized with `useCallback`; Tailwind v4 semantic tokens only; `cn()` for class merging. (AGENTS.md)
- Every behavioral change ships tests beside the code. Gate: `pnpm verify` and `pnpm test:e2e`. (AGENTS.md)
- **Commits require explicit user permission** (AGENTS.md). Each task's Commit step is subject to that gate; never commit or push without asking.

## Review Focus

These five inputs/failure modes are the most likely to break in normal use; each is pinned to a test in the task that owns the code.

1. **A close or unarchive racing `archived = true` must never spawn a successor.** Pinned: Task 4's rule-0 direct helper test AND Task 6's "repeating fixture + open assignment archives without inserting a successor" test.
2. **Zero-open repeating task: every active assignee gets exactly one successor, a removed-from-project assignee gets none.** Pinned: Task 7's unarchive triggers and Task 8's date-edit/close-time tests (including "removed assignee never spawned").
3. **A plain wizard save (rename/priority) must not reopen finished work for members who were never removed.** Pinned: Task 5's `syncTaskAssignments` "existing member with no open row → no insert" test and Task 12's audit of wizard-save e2e expectations.
4. **An archived task's due-date cell must show the task's now-today date, not a stale closed assignment's date.** Pinned: Task 12's frozen-view e2e assertion; if it fails, Task 11 changes `tasks-table.tsx`'s `lead ? lead.endDate : task.endDate` fallback for zero-open tasks.
5. **A stale client tab submitting a mutation after archive must get a rejected action/toast, never a crash or a write; Delete and Unarchive still work.** Pinned: Task 8's freeze table test (`updateTask`, `updateAssignmentStatus`, `updateAssignmentComment`, `updateTaskPriority`, all comment actions rejected; `deleteTask`/`unarchiveTask` succeed).

---

### Task 1: Database schema — `archived` flag and `task_assignee` roster

**Files:**
- Modify: `lib/drizzle/schema.ts:443-499`
- Modify: `lib/drizzle/schema.test.ts`
- Create (generated): `drizzle/00NN_<name>.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/00NN_snapshot.json`
- Commit also: `docs/superpowers/specs/2026-11-19-task-archive-design.md`, `docs/superpowers/plans/2026-11-19-task-archive.md`

**Interfaces:**
- Consumes: `tasksTable`, `taskAssignmentsTable`, `usersTable`, `projectsTable` and the `pgTable`/`uniqueIndex`/`timestamp`/`text` conventions at `lib/drizzle/schema.ts:443-499`.
- Produces: `tasksTable.archived: boolean("archived").notNull().default(false)`; `taskAssigneesTable` mapped to `task_assignee` with `id` (text PK, uuid default), `taskId` → `task.id` cascade, `userId` → `user.id` cascade, `createdAt`/`updatedAt` (mirror `taskAssignmentsTable`), and a plain unique index on `(taskId, userId)`.

- [ ] **Step 1: Write the failing schema test**

Add to `lib/drizzle/schema.test.ts` (extend imports with `getTableConfig` and `taskAssigneesTable`):

```ts
it("adds archived and the task_assignee membership table", () => {
  expect(getTableColumns(tasksTable).archived.default).toBe(false)

  const config = getTableConfig(taskAssigneesTable)
  expect(config.name).toBe("task_assignee")
  expect(config.columns.map((c) => c.name)).toEqual(
    expect.arrayContaining([
      "id", "task_id", "user_id", "created_at", "updated_at",
    ])
  )
  const unique = config.indexes.find((i) => i.config.unique)
  expect(
    unique?.config.columns.map((c) => (c as { name: string }).name)
  ).toEqual(expect.arrayContaining(["task_id", "user_id"]))
  expect(config.foreignKeys.map((fk) => fk.onDelete)).toEqual(
    expect.arrayContaining(["cascade", "cascade"])
  )
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run lib/drizzle/schema.test.ts`
Expected: FAIL — `archived`/`taskAssigneesTable` are undefined.

- [ ] **Step 3: Implement the schema**

In `lib/drizzle/schema.ts`, add `archived: boolean("archived").notNull().default(false)` to `tasksTable` (after `endDate`); import `boolean` from `drizzle-orm/pg-core` if not already present. Define `taskAssigneesTable` immediately after `taskAssignmentsTable`, mirroring its column and `(table) => [...]` shape with `uniqueIndex("task_assignee_task_user_unique").on(table.taskId, table.userId)`. No soft-delete column.

- [ ] **Step 4: Generate and review the migration**

Run: `pnpm db:generate`
Expected: one new `drizzle/00NN_*.sql` plus meta files; SQL adds `archived` with `DEFAULT false NOT NULL` and creates `task_assignee` with both cascades and the unique index. Do not edit generated files by hand. Apply: `pnpm db:migrate` (and `pnpm test:db:migrate` for the test DB).

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run lib/drizzle/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit** (after user permission)

```bash
git add lib/drizzle/schema.ts lib/drizzle/schema.test.ts drizzle/ docs/superpowers/specs/2026-11-19-task-archive-design.md docs/superpowers/plans/2026-11-19-task-archive.md
git commit -m "feat(tasks): add archived flag and assignee membership table"
```

---

### Task 2: DTO schemas for archive state and assignee roster

**Files:**
- Modify: `actions/tasks/schemas.ts:148-176, 200-235`
- Modify: `actions/tasks/schemas.test.ts`
- Modify (fixtures only, so typecheck stays green): `lib/tasks/list.test.ts:33-54`, `stores/project-tasks/project-tasks-store.test.ts:26-47`, `components/projects/tasks-card.tsx:99-127`

**Interfaces:**
- Consumes: `TaskRecordSchema`, `TaskWithAssignmentsSchema`, `TaskAssignmentSchema` from `actions/tasks/schemas.ts`.
- Produces: `TaskRecordSchema.archived: z.boolean()`; `TaskWithAssignmentsSchema.assigneeIds: z.array(z.string())` (inherited into `TaskWithAssignmentsDTO`); `ArchiveTaskSchema` with `{ projectId: z.uuid(), taskId: z.uuid(), closeAs: z.enum(["done", "cancelled"]) }` and `ArchiveTaskDTO`; `UnarchiveTaskSchema` with `{ projectId: z.uuid(), taskId: z.uuid() }`, `UnarchiveTaskDTO`, and `UnarchiveTaskResultSchema = z.object({ spawned: z.array(TaskAssignmentSchema) })`, `UnarchiveTaskResultDTO`.

- [ ] **Step 1: Write the failing tests**

Append to `actions/tasks/schemas.test.ts` (a local `minimalRow` supplies every existing `TaskRecordSchema` field):

```ts
it("carries archived and the membership roster on task DTOs", () => {
  expect(TaskRecordSchema.parse({ ...minimalRow, archived: false }))
    .toMatchObject({ archived: false })
  expect(
    TaskWithAssignmentsSchema.parse({
      ...minimalRow, archived: true, assigneeIds: ["u1"],
      assignments: [], commentCount: 0, closedCount: 0,
    })
  ).toMatchObject({ archived: true, assigneeIds: ["u1"] })
})

it("validates archive and unarchive payloads", () => {
  expect(ArchiveTaskSchema.parse({
    projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "done",
  })).toEqual({ projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "done" })
  expect(ArchiveTaskSchema.safeParse({
    projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "paused",
  }).success).toBe(false)
  expect(UnarchiveTaskSchema.parse({ projectId: PROJECT_ID, taskId: TASK_ID }))
    .toEqual({ projectId: PROJECT_ID, taskId: TASK_ID })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/schemas.test.ts`
Expected: FAIL — imports/schemas do not exist and `archived` is stripped by Zod.

- [ ] **Step 3: Implement the schemas**

In `actions/tasks/schemas.ts`: add `archived: z.boolean()` to `TaskRecordSchema`; add `assigneeIds: z.array(z.string())` to `TaskWithAssignmentsSchema`; add the two input schemas and `UnarchiveTaskResultSchema` next to `AssignmentStatusResultSchema`; append all inferred DTO type exports to the existing type block.

- [ ] **Step 4: Update every DTO construction site for typecheck**

Add `archived: false, assigneeIds: []` (or a meaningful roster) to the `makeTask` fixtures in `lib/tasks/list.test.ts` and `stores/project-tasks/project-tasks-store.test.ts`, to `buildOptimisticTask`'s object in `components/projects/tasks-card.tsx` (`archived: editing?.archived ?? false`, `assigneeIds: data.assigneeIds`), and to any fixture in `schemas.test.ts`. Do not change behavior elsewhere in this task.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run actions/tasks/schemas.test.ts lib/tasks/list.test.ts stores/project-tasks/project-tasks-store.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** (after user permission)

```bash
git add actions/tasks/schemas.ts actions/tasks/schemas.test.ts lib/tasks/list.test.ts stores/project-tasks/project-tasks-store.test.ts components/projects/tasks-card.tsx
git commit -m "feat(tasks): add archive DTOs and assignee roster"
```

---

### Task 3: Read path returns `archived` and `assigneeIds`

**Files:**
- Modify: `actions/tasks/queries.ts:81-99, 120-146, 492-561, 889-918`
- Modify: `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `getTaskRowsByProject`, `getTaskRow`, `getFullAssignmentRowsByTaskIds`, `getLatestAssignmentRowsByTaskIds`, `toTaskRecord` (all in `queries.ts`); `state.mock` helper in `tasks.test.ts:12-51`.
- Produces: `getTasksWithAssignments(projectId)` returns `TaskWithAssignmentsDTO[]` including `archived` and `assigneeIds`; `getTaskWithAssignments(taskId)` returns `{ record: TaskRecordDTO; assignments; closedCount; assigneeIds: string[] }`. `createTask`/`updateTask` action results add `assigneeIds: loaded.assigneeIds` (Task 7 handles the rest of those actions; this task only adds the field).

- [ ] **Step 1: Write the failing test**

In `actions/tasks/tasks.test.ts`, add a case inside the existing `getTasks` describe: mock `state.mock.onSelect(schema.taskAssigneesTable).respond([{ taskId: TASK_ID, userId: USER_ID }, { taskId: TASK_ID, userId: OTHER_ID }])`, mock the task row with `archived: true`, then assert:

```ts
const result = await getTasks({ projectId: PROJECT_ID })
expect(result.data?.[0]).toMatchObject({
  archived: true,
  assigneeIds: [USER_ID, OTHER_ID],
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "assignee roster"`
Expected: FAIL — `archived`/`assigneeIds` absent from the returned DTO (output schema strips them).

- [ ] **Step 3: Implement the reads**

In `queries.ts`: add leaf `getAssigneeUserIdsByTaskIds(taskIds: string[])` selecting `{ taskId, userId }` from `taskAssigneesTable` with `inArray(...taskId, taskIds)`. In `getTasksWithAssignments`, fetch it in the existing `Promise.all` and build a `Map<string, string[]>` consumed when mapping each task. In `getTaskWithAssignments`, call the same leaf with `[taskId]` and return `assigneeIds` alongside `record`/`assignments`/`closedCount`. Map `row.archived` in `toTaskRecord`. Export the new leaf in the `queries` object. In `actions/tasks/actions.ts`, add `assigneeIds: loaded.assigneeIds` to the two `{...loaded.record, ...}` result objects in `createTask`/`updateTask` (no other change here).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run actions/tasks/tasks.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** (after user permission)

```bash
git add actions/tasks/queries.ts actions/tasks/actions.ts actions/tasks/tasks.test.ts
git commit -m "feat(tasks): load archived flag and assignee roster"
```

---

### Task 4: The shared spawn helper (rule 0, three rules, one insert)

**Files:**
- Modify: `actions/tasks/queries.ts` (new helper + leaf queries + `queries` object export)
- Modify: `actions/tasks/tasks.test.ts` (direct helper cases)

**Interfaces:**
- Consumes: `getTaskRow` (`queries.ts:112`), `getOpenAssignments` (`queries.ts:244`), `hasLaterDatedAssignment` (`queries.ts:259`), `computeNextOccurrence` (`lib/tasks/recurrence.ts:24`), `type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]` (pattern from `actions/legacy/payments.ts:80`).
- Produces: `type QueryClient = typeof db | Transaction`; `type SpawnOptions = { anchor: Date; client?: QueryClient; onlyUserIds?: string[]; closing?: { userId: string; endDate: Date | null } }`; `spawnEligibleAssignments(taskId: string, opts: SpawnOptions): Promise<string[]>` (returns inserted assignment ids). Exported as `queries.spawnEligibleAssignments` for direct tests. `AssignmentSpawn` stays `{ taskId, userId, startDate, endDate }`.

- [ ] **Step 1: Write the failing direct-helper tests**

In `tasks.test.ts`, import `queries from "@/actions/tasks/queries"` and add a `describe("spawnEligibleAssignments")`. Use `state.mock.onSelect(schema.tasksTable).respond([makeTaskRow({ recurrence: "weekly", archived: true, endDate: new Date("2026-11-30T23:00:00") })])` and assert:

```ts
it("never spawns for an archived task (rule 0)", async () => {
  expect(await queries.spawnEligibleAssignments(TASK_ID, { anchor: new Date() }))
    .toEqual([])
  expect(state.mock.calls.some((c) => c.sql.includes("insert into \"task_assignment\"")))
    .toBe(false)
})
it("never spawns for a non-repeating task", async () => { /* archived: false, recurrence: null → [] */ })
it("requires an active member and no open row", async () => { /* no task_assignee rows → []; open row for the only member → [] */ })
it("skips candidates whose next occurrence is out of range", async () => { /* endDate in the past → [] */ })
it("inserts one open assignment for an eligible member with the computed window", async () => {
  const ids = await queries.spawnEligibleAssignments(TASK_ID, {
    anchor: new Date("2026-11-16T08:00:00"),
  })
  expect(ids).toHaveLength(1)
  const insert = state.mock.calls.find((c) => c.sql.includes("insert into \"task_assignment\""))
  expect(insert?.sql).toContain("todo")
})
it("keeps the closing assignee's later-dated guard", async () => {
  // task_assignee membership for USER_ID/OTHER_ID, no open rows,
  // hasLaterDatedAssignment mocked via onSelect → true for USER_ID,
  // closing: { userId: USER_ID, endDate: new Date("2026-11-16T10:00:00") }
  // → only OTHER_ID is spawned.
})
it("respects onlyUserIds when a caller scopes the helper", async () => {
  // two eligible members, onlyUserIds: [USER_ID] → one insert for USER_ID.
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "spawnEligibleAssignments"`
Expected: FAIL — helper is not exported.

- [ ] **Step 3: Implement the helper**

In `queries.ts`: add `QueryClient`/`SpawnOptions`; thread an optional `client: QueryClient = db` parameter onto the existing leaves `getTaskRow`, `getOpenAssignments`, `hasLaterDatedAssignment` (all reads use `client.select/...`); add leaf `getActiveAssigneeIds(taskId, projectId, client)` selecting `taskAssigneesTable.userId` inner-joined to `projectMembershipTable` on `userId` + `projectId` (defence against drift); add leaf `insertAssignmentRows(rows: AssignmentSpawn[], client): Promise<string[]>` doing one `.insert(...).values(rows).returning({ id: ... })`. Implement `spawnEligibleAssignments` as a composed query (zero direct `db` calls): load task → `if (!task || task.archived || !task.recurrence) return []` → intersect `getActiveAssigneeIds` with `onlyUserIds` and subtract `getOpenAssignments` user ids → for each remaining user call `computeNextOccurrence({ recurrence, interval, daysOfWeek, startTime, endDate: task.endDate }, opts.anchor)` → skip when `opts.closing?.userId === userId && await hasLaterDatedAssignment(...)` → collect `AssignmentSpawn` with `endDate: atTime(next, task.endTime)` → `return insertAssignmentRows(spawns, opts.client ?? db)` (empty array short-circuits to `[]`). `computeNextOccurrence` already rejects occurrences past `endOfDay(task.endDate)`, so no second range check is needed. Export it in the `queries` object.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "spawnEligibleAssignments" && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** (after user permission)

```bash
git add actions/tasks/queries.ts actions/tasks/tasks.test.ts
git commit -m "feat(tasks): add recurrence-checked spawn helper"
```

---

### Task 5: Membership-based sync, add-assignee spawn (trigger d), project-member cleanup

**Files:**
- Modify: `actions/tasks/queries.ts:624-682, 731-776`
- Modify: `actions/projects/queries.ts:549-585`
- Modify: `actions/tasks/tasks.test.ts`, `actions/projects/project-membership.test.ts`
- Modify: `lib/drizzle/seed-e2e.ts:105-198` (membership rows for the two role fixtures)

**Interfaces:**
- Consumes: `firstAssignmentWindow` (`lib/tasks/assignments.ts:66`), `spawnEligibleAssignments` from Task 4, `getOpenAssignments` from `queries.ts`.
- Produces: `createTask(values, assigneeIds)` inserts one `task_assignee` row per unique id; `syncTaskAssignments(taskId, assigneeIds, taskRow, unassignAs)` diffs against `task_assignee`, never against open rows; `deleteProjectMembership` also deletes the user's `task_assignee` rows for that project's tasks in the same transaction.

- [ ] **Step 1: Write the failing tests**

In `tasks.test.ts`:

```ts
it("a new member of a repeating task gets membership plus a range-checked open row", async () => { /* membership insert + one task_assignment insert; out-of-range → membership only */ })
it("a new member of a non-repeating task gets membership plus a firstAssignmentWindow row", async () => { /* no range check */ })
it("a removed member loses membership and their open row closes with unassignAs", async () => { /* default cancelled when absent */ })
it("an existing member with no open row gets no insert on a plain save", async () => {
  await updateTask({ ...validTask, projectId: PROJECT_ID, taskId: TASK_ID })
  expect(state.mock.calls.some((c) => c.sql.includes("insert into \"task_assignments\""))).toBe(false)
})
```

In `project-membership.test.ts`, extend the existing removal test (around line 206) with an assertion that `delete from "task_assignee"` ran for the removed user and that the existing `update "task_assignment" ... cancelled` assertion still passes.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts actions/projects/project-membership.test.ts -t "assignee|member"`
Expected: FAIL — sync still diffs open rows and no membership rows are written.

- [ ] **Step 3: Implement membership sync and removal cleanup**

In `queries.ts`: in `createTask`'s transaction, insert `taskAssigneesTable` rows for `assigneeIds` before the assignment insert. Rewrite `syncTaskAssignments` to (a) read existing membership ids and open rows, (b) in one transaction: delete membership + close open rows for removed users grouped by `unassignAs ?? "cancelled"` (history preserved), insert membership for new users, then for each new user on a repeating task call `spawnEligibleAssignments(taskId, { anchor: new Date(), client: tx, onlyUserIds: [userId] })`, on a non-repeating task insert one open row via `firstAssignmentWindow(taskRow)`; existing members are left untouched. In `actions/projects/queries.ts:deleteProjectMembership`, add a `tx.delete(taskAssigneesTable)` using the same project-scoped task-id subquery as the existing assignment cancellation. Export `taskAssigneesTable` import there.

- [ ] **Step 4: Update the e2e seed**

In `lib/drizzle/seed-e2e.ts`, delete `taskAssigneesTable` rows for the two fixture tasks before deleting their assignments/tasks, and insert membership rows for `user2@test.local` on both `ROLES_PROJECT.openTask` and `ROLES_PROJECT.repeatTask` alongside the existing assignment fixtures. Keep ids/names unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts actions/projects/project-membership.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** (after user permission)

```bash
git add actions/tasks/queries.ts actions/projects/queries.ts actions/tasks/tasks.test.ts actions/projects/project-membership.test.ts lib/drizzle/seed-e2e.ts
git commit -m "feat(tasks): track assignee membership and clean up on removal"
```

---

### Task 6: Archive action and spawn suppression

**Files:**
- Modify: `actions/tasks/util.ts`, `actions/tasks/queries.ts`, `actions/tasks/actions.ts`, `actions/tasks/index.ts`, `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `projectAction`, `returnActionError`, `canManageWork`, `SuccessSchema`, `ArchiveTaskSchema` from Task 2.
- Produces: `assertTaskMutable(task: { archived: boolean } | undefined): void` in `util.ts`; `queries.archiveTaskRow(taskId, projectId, closeAs): Promise<void>`; exported action `archiveTask` with input `ArchiveTaskDTO`, output `SuccessSchema`, `metadata({ revalidate: ["/app/proyectos/:projectId"] })`; barrel export from `actions/tasks/index.ts`.

- [ ] **Step 1: Write the failing tests**

In `tasks.test.ts`, import `archiveTask` from `@/actions/tasks` and add:

```ts
it("archives a repeating task, moves its due date to today, closes all open rows and spawns nothing", async () => {
  // task row: recurrence "weekly", archived false, endDate in the future;
  // two open assignments for two members; task_assignee rows for both.
  const result = await archiveTask({ projectId: PROJECT_ID, taskId: TASK_ID, closeAs: "cancelled" })
  expect(defaultIsSuccess(result)).toBe(true)
  const updates = state.mock.calls.filter((c) => c.sql.includes("update \"task\""))
  expect(updates.some((c) => c.sql.includes("archived"))).toBe(true)
  expect(state.mock.calls.some((c) => c.sql.includes("insert into \"task_assignment\""))).toBe(false)
  expect(state.mock.calls.some((c) => c.sql.includes("delete from \"task_assignee\""))).toBe(false)
})
it("rejects archive for a collaborator", async () => { grantAccess("collaborator"); /* FORBIDDEN */ })
```

Also add a direct `assertTaskMutable` unit case: `{ archived: true }` throws, `{ archived: false }` does not.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "archive"`
Expected: FAIL — `archiveTask` is not exported.

- [ ] **Step 3: Implement the action and query**

In `util.ts`, add `assertTaskMutable` using `returnActionError("FORBIDDEN")` for archived and `"NOT_FOUND"` for missing. In `queries.ts`, add leaf `archiveTaskRow`: one `db.transaction` that updates `tasksTable` (`archived: true`, `endDate: new Date()`) and directly updates every open `taskAssignmentsTable` row of that task to `closeAs` — no call to `updateAssignmentStatus`, no `spawnEligibleAssignments`, no membership writes. In `actions.ts`, add `archiveTask = projectAction(ArchiveTaskSchema)...` following `updateTaskPriority`: `canManageWork` guard → `assertTaskMutable(await queries.getTaskRowInProject(...))` → `queries.archiveTaskRow(...)` → `{ success: true }`. Add `getTaskRowInProject` to an enriched shape that includes `archived` (Task 8 extends it further). Export `archiveTask` from `index.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "archive" && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** (after user permission)

```bash
git add actions/tasks/util.ts actions/tasks/queries.ts actions/tasks/actions.ts actions/tasks/index.ts actions/tasks/tasks.test.ts
git commit -m "feat(tasks): add archive action without spawning"
```

---

### Task 7: Unarchive action and trigger (a)

**Files:**
- Modify: `actions/tasks/schemas.ts` (already declared in Task 2), `actions/tasks/queries.ts`, `actions/tasks/actions.ts`, `actions/tasks/index.ts`, `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `UnarchiveTaskSchema`, `UnarchiveTaskResultSchema` from Task 2; `spawnEligibleAssignments` from Task 4; `getAssignmentViewById` + `toTaskAssignmentDTO` from `queries.ts`/`lib/tasks/assignments.ts`.
- Produces: `queries.unarchiveTaskRow(taskId, projectId, anchor): Promise<string[]>`; exported action `unarchiveTask` input `UnarchiveTaskDTO`, output `UnarchiveTaskResultDTO` (`{ spawned: TaskAssignmentDTO[] }`), `metadata({ revalidate: ["/app/proyectos/:projectId"] })`.

- [ ] **Step 1: Write the failing tests**

In `tasks.test.ts`:

```ts
it("unarchiving a repeating in-range task spawns for every active assignee without an open row", async () => {
  // archived task, recurrence weekly, endDate today, two task_assignee rows, no open rows
  const result = await unarchiveTask({ projectId: PROJECT_ID, taskId: TASK_ID })
  expect(result.data?.spawned).toHaveLength(2)
  expect(state.mock.calls.some((c) => c.sql.includes("insert into \"task_assignment\""))).toBe(true)
})
it("unarchiving out of range spawns nothing", async () => { /* endDate in the past → spawned: [] */ })
it("unarchiving a non-repeating task spawns nothing", async () => { /* spawned: [] */ })
it("a member removed from the project is never spawned for", async () => {
  // task_assignee row absent for OTHER_ID (or no project_membership row) → only USER_ID spawned
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "unarchiv"`
Expected: FAIL — `unarchiveTask` is not exported.

- [ ] **Step 3: Implement the action and query**

In `queries.ts`, add `unarchiveTaskRow`: one `db.transaction` that sets `archived = false`, then calls `spawnEligibleAssignments(taskId, { anchor: new Date(), client: tx })` and returns its ids. In `actions.ts`, add `unarchiveTask = projectAction(UnarchiveTaskSchema)...` with the same guard/revalidate as `archiveTask`; load each spawned id via `queries.getAssignmentViewById` and map with `toTaskAssignmentDTO`; return `{ spawned }`. Export from `index.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "unarchiv" && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** (after user permission)

```bash
git add actions/tasks/queries.ts actions/tasks/actions.ts actions/tasks/index.ts actions/tasks/tasks.test.ts
git commit -m "feat(tasks): add unarchive with recurrence-checked spawn"
```

---

### Task 8: Date-edit spawn (b), close-time cascade refactor (c), and the archived freeze

**Files:**
- Modify: `actions/tasks/queries.ts`, `actions/tasks/actions.ts`, `actions/tasks/util.ts`, `actions/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `spawnEligibleAssignments` (Task 4), `assertTaskMutable` (Task 6), `getTaskRowInProject` (extend to return `{ id, projectId, archived, endDate, recurrence }`), `getAssignmentForRow`/`getAssignmentForComment` (extend with `archived`).
- Produces: `updateAssignmentStatus` now inserts `AssignmentSpawn[]` in one transaction and returns `string[]` of inserted ids; its output stays `AssignmentStatusResultSchema` with `nextAssignment` = the successor for the **closing** assignee (healed rows arrive via `router.refresh()` reseed). `assertTaskInProject` returns `{ archived: boolean }` so `assertCommentAccess` can freeze all comment actions.

- [ ] **Step 1: Write the failing tests**

In `tasks.test.ts`, add cases (use `state.mock` fixtures with `task_assignee` rows and view rows as in Tasks 4–7):

```ts
it("a due-date change on a repeating task spawns for an active member with no open row", async () => { /* one insert with computed window */ })
it("a due-date change skips a member with an open row, a removed assignee, an unchanged date, a non-repeating task, and an out-of-range occurrence", async () => { /* table of five cases, zero inserts each */ })
it("closing the latest assignment still spawns its successor with the closing row's date as anchor", async () => { /* existing case around line 627 stays passing */ })
it("a second active member with no open row is healed on close, while a member with an open row is untouched", async () => { /* two inserts, one for each eligible user */ })
it("closing an assignment on an archived task spawns nothing", async () => { /* archived: true in getAssignmentForRow → FORBIDDEN, zero inserts */ })
it("freezes every mutation while archived", async () => {
  for (const action of [
    () => updateTask({ ...validTask, taskId: TASK_ID }),
    () => updateAssignmentStatus({ projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, status: "done" }),
    () => updateAssignmentComment({ projectId: PROJECT_ID, assignmentId: ASSIGNMENT_ID, comment: "hi" }),
    () => updateTaskPriority({ projectId: PROJECT_ID, taskId: TASK_ID, priority: "high" }),
    () => createComment({ projectId: PROJECT_ID, taskId: TASK_ID, content: "hi" }),
    () => updateComment({ projectId: PROJECT_ID, taskId: TASK_ID, commentId: COMMENT_ID, content: "hi" }),
    () => deleteComment({ projectId: PROJECT_ID, taskId: TASK_ID, commentId: COMMENT_ID }),
  ]) expect((await action()).serverError?.code).toBe("FORBIDDEN")
  // deleteTask and unarchiveTask still return success for the same archived row.
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run actions/tasks/tasks.test.ts -t "spawn|freez|archived"`
Expected: FAIL — no date-change spawn, no freeze checks, close-time cascade is still in the action.

- [ ] **Step 3: Refactor the close-time cascade through the helper**

In `actions.ts:updateAssignmentStatus`: keep permission and terminal/reopen validation, add `if (row.archived) returnActionError("FORBIDDEN")` immediately after `getAssignmentForRow`. Replace the inline `hasLaterDatedAssignment` + `computeNextOccurrence` block with one `spawnEligibleAssignments` call guarded by `crossesToTerminal && row.recurrence && !row.archived`, passing `anchor: row.endDate ?? new Date()` and `closing: { userId: row.userId, endDate: row.endDate }`. In `queries.ts`, change `updateAssignmentStatus(assignmentId, status, spawns: AssignmentSpawn[])` to insert all rows in its existing transaction and return `string[]`; in the action, load all returned view rows and set `nextAssignment` to the one whose `userId === row.userId` (null when none).

- [ ] **Step 4: Add trigger (b) and the freeze guards**

In `actions.ts:updateTask`: fetch `previous = await queries.getTaskRowInProject(taskId, projectId)` before `updateTaskRow`, call `assertTaskMutable(previous)`, then after `syncTaskAssignments` call `spawnEligibleAssignments(taskId, { anchor: previous.recurrence ? (parsedInput.startDate ? new Date(parsedInput.startDate) : new Date()) : new Date() })` only when `previous.recurrence && previousEnd !== nextEnd`, where `previousEnd = previous.endDate?.getTime() ?? null` and `nextEnd = parsedInput.endDate ? new Date(parsedInput.endDate).getTime() : null` (so unchanged/null dates compare equal and never spawn). Add `assertTaskMutable` to `updateTaskPriority`. In `queries.ts`, enrich `getAssignmentForRow` and `getAssignmentForComment` with `tasksTable.archived as archived` and check it in the two assignment actions. In `util.ts`, return the row from `assertTaskInProject` and reject archived rows inside `assertCommentAccess` (covers all four comment actions). Keep `deleteTask`/`unarchiveTask` exempt.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run actions/tasks/tasks.test.ts && pnpm typecheck`
Expected: PASS (all pre-existing cases, including `nextAssignment` assertions, still pass).

- [ ] **Step 6: Commit** (after user permission)

```bash
git add actions/tasks/queries.ts actions/tasks/actions.ts actions/tasks/util.ts actions/tasks/tasks.test.ts
git commit -m "feat(tasks): unify spawn triggers and freeze archived tasks"
```

---

### Task 9: Optimistic store — `setArchived` and the two menu hooks

**Files:**
- Modify: `stores/project-tasks/project-tasks-reducer.ts:16-65, 99-246`
- Modify: `stores/project-tasks/use-project-tasks-actions.ts:11-30, 177-182, 350-363`
- Modify: `stores/project-tasks/project-tasks-store.test.ts`

**Interfaces:**
- Consumes: `archiveTask`/`unarchiveTask` server actions from `@/actions/tasks` (Tasks 6–7), `run`/`settle` from `useOptimisticAction`/`useSettle`.
- Produces: reducer case `{ type: "setArchived"; taskId: string; archived: boolean; closeAs?: "done" | "cancelled"; spawned?: TaskAssignmentDTO[]; endDate?: Date }`; hooks `archiveTask(projectId: string, taskId: string, closeAs: "done" | "cancelled"): Promise<void>` and `unarchiveTask(projectId: string, taskId: string): Promise<void>` returned from `useProjectTasksActions()`.

- [ ] **Step 1: Write the failing reducer tests**

In `project-tasks-store.test.ts`:

```ts
it("setArchived closes every open row with the chosen disposition and bumps closedCount", () => {
  store.getState().pend({
    type: "setArchived", taskId: "a", archived: true,
    closeAs: "cancelled", endDate: NOW,
  })
  store.getState().commit(id)
  expect(store.getState().optimistic.tasks[0].archived).toBe(true)
  expect(store.getState().optimistic.tasks[0].assignments.every(
    (row) => row.status === "cancelled"
  )).toBe(true)
  expect(store.getState().optimistic.tasks[0].closedCount).toBe(2)
})
it("setArchived false appends spawned rows and clears the archived flag", () => {
  // pend archived:false, commit with spawned: [openRow] → assignments contains openRow, archived false
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run stores/project-tasks/project-tasks-store.test.ts -t "setArchived"`
Expected: FAIL — unknown action type.

- [ ] **Step 3: Implement the reducer case**

Add the `setArchived` variant to `ProjectTaskAction`. In the switch, map the target task: set `archived` (and `endDate` when supplied); when `closeAs` is present, map only open rows to that status and add their count to `closedCount` (clamped at ≥0); when `spawned` is present, append any row whose id is not already present and re-run `sortAssignments`. Never spawn or delete history in the reducer.

- [ ] **Step 4: Implement the hooks**

In `use-project-tasks-actions.ts`, import the two actions aliased, add `executeArchive`/`executeUnarchive` `useAction` hooks, and add:

```ts
async function archiveTask(projectId: string, taskId: string, closeAs: "done" | "cancelled") {
  const result = await run(
    { type: "setArchived", taskId, archived: true, closeAs, endDate: new Date() },
    () => executeArchive({ projectId, taskId, closeAs })
  )
  settle(result, t("projects.tasks.taskArchived"))
}

async function unarchiveTask(projectId: string, taskId: string) {
  const result = await run(
    { type: "setArchived", taskId, archived: false },
    () => executeUnarchive({ projectId, taskId }),
    {
      commitAction: (r) => r.data
        ? { type: "setArchived", taskId, archived: false, spawned: r.data.spawned }
        : undefined,
    }
  )
  settle(result, t("projects.tasks.taskUnarchived"))
}
```

Return both from the hook. No `useCallback` needed: local handlers call hooks and are not passed as callbacks to children (if they are, wrap with `useCallback` per AGENTS.md).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run stores/project-tasks/project-tasks-store.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** (after user permission)

```bash
git add stores/project-tasks/project-tasks-reducer.ts stores/project-tasks/use-project-tasks-actions.ts stores/project-tasks/project-tasks-store.test.ts
git commit -m "feat(tasks): add archive state to the optimistic store"
```

---

### Task 10: Two-way filter, list ordering, form seeding, and translations

**Files:**
- Modify: `lib/tasks/list.ts:7, 115-138`, `lib/tasks/list.test.ts:294-409`
- Modify: `lib/tasks/filter.ts:10-25`, `lib/tasks/filter.test.ts`
- Modify: `components/projects/tasks-filter.tsx:7-11`, `components/projects/tasks-card.tsx:51, 169-195`
- Modify: `components/projects/task-form.tsx:67-88`
- Modify: `messages/en.json:267-317`, `messages/es.json:267-317`

**Interfaces:**
- Consumes: `TasksVisibilityFilter` from `lib/tasks/list.ts`; `TaskWithAssignmentsDTO.assigneeIds` from Task 2.
- Produces: `TasksVisibilityFilter = "open" | "archived"`; `selectTasks(tasks, filter, now)` partitions on `archived` and sorts both views by `endDate` ascending, nulls last; `isOpenAssignment` and `assignmentCounts` remain exported from `lib/tasks/filter.ts`; `shouldShowTask` is removed.

- [ ] **Step 1: Write the failing tests and delete the obsolete ones**

Replace `describe("selectTasks")` in `lib/tasks/list.test.ts` with:

```ts
it("open lists non-archived tasks by endDate ascending, nulls last", () => {
  const soon = makeTask({ id: "soon", archived: false, endDate: new Date("2026-11-15T00:00:00"), assignments: [makeAssignment({ status: "done" })] })
  const later = makeTask({ id: "later", archived: false, endDate: new Date("2026-11-20T00:00:00") })
  const noDue = makeTask({ id: "no-due", archived: false, endDate: null })
  const archived = makeTask({ id: "archived", archived: true, endDate: new Date("2026-11-01T00:00:00") })
  expect(selectTasks([archived, later, noDue, soon], "open", NOW).map((t) => t.id))
    .toEqual(["soon", "later", "no-due"])
})
it("archived lists only archived tasks by endDate ascending, nulls last", () => {
  // two archived + one open → only the archived ids, ascending, null last
})
```

Delete the whole `describe("shouldShowTask")` block from `lib/tasks/filter.test.ts` (keep `assignmentCounts`). Add one assertion in `lib/tasks/list.test.ts` that `assignmentCounts` still counts a status mix (import from `./filter`).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run lib/tasks/list.test.ts lib/tasks/filter.test.ts`
Expected: FAIL — `"open"`/`"archived"` are not valid filter values.

- [ ] **Step 3: Implement the filter change**

In `lib/tasks/list.ts`, change the type to `"open" | "archived"`, partition with `task.archived`, and use `byEndDateAsc` for both cases (remove `byEndDateDesc` if unused). In `lib/tasks/filter.ts`, delete `shouldShowTask` and the now-unused `endOfDay`/`TaskAssignmentDTO` imports; keep `isOpenAssignment` and `assignmentCounts`. In `components/projects/tasks-filter.tsx`, set `OPTIONS = ["open", "archived"] as const`. In `components/projects/tasks-card.tsx`, default `useState<TasksVisibilityFilter>("open")`, switch the empty-state key to `filter === "archived" ? t("projects.tasks.noArchived") : t("projects.tasks.noTasks")`, and destructure `archiveTask`/`unarchiveTask` from `useProjectTasksActions()` (wiring into the table happens in Task 11).

- [ ] **Step 4: Seed the form from membership, not open rows**

In `components/projects/task-form.tsx`, derive the protected/seeded ids from `task?.assigneeIds` intersected with current `members` (keep `protectedIds` semantics for the disposition dialog — a member is protected when they are in the roster and still a project member); remove the `isTerminalStatus` import if unused. Result: a zero-open task shows its roster.

- [ ] **Step 5: Update translations in both files identically**

Replace `both`/`unfinished`/`finished`/`noFinished` with `open`, `archived`, `noArchived`; keep `filterLabel` (reword only if needed). Add `archive: { title, message, markDone, markCancelled }`, `archiveTask`, `unarchiveTask`, `taskArchived`, `taskUnarchived` using the exact en/es copy from spec table #10. Do not touch `myTasks.*` or any dynamic key map.

- [ ] **Step 6: Run tests, typecheck and translation parity**

Run: `pnpm vitest run lib/tasks/list.test.ts lib/tasks/filter.test.ts && pnpm typecheck && node -e 'const en=require("./messages/en.json"),es=require("./messages/es.json"); const keys=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?keys(v,p+k+"."):[p+k]); if(JSON.stringify(keys(en).sort())!==JSON.stringify(keys(es).sort())) process.exit(1)'`
Expected: PASS (identical key sets).

- [ ] **Step 7: Commit** (after user permission)

```bash
git add lib/tasks/list.ts lib/tasks/list.test.ts lib/tasks/filter.ts lib/tasks/filter.test.ts components/projects/tasks-filter.tsx components/projects/tasks-card.tsx components/projects/task-form.tsx messages/en.json messages/es.json
git commit -m "feat(tasks): switch to open/archived filter and membership seeding"
```

---

### Task 11: Archive menu, frozen read-only archived rows, and due-date fallback

**Files:**
- Create: `components/projects/task-archive-menu-item.tsx`
- Modify: `components/projects/tasks-table.tsx:40-67, 98-283`, `components/projects/task-open-assignment-rows.tsx:26-68`, `components/projects/tasks-card.tsx:176-195`

**Interfaces:**
- Consumes: `ActionMenu`'s `children` slot (`components/common/action-menu.tsx:59`), `ActionConfirmDialog` (`components/common/action-confirm-dialog.tsx`), `archiveTask`/`unarchiveTask` hooks from Task 9, `canMutate` computation at `tasks-table.tsx:62-67`.
- Produces: `TaskArchiveMenuItem` with props `{ task: TaskWithAssignmentsDTO; canArchive: boolean; onArchive: (closeAs: "done" | "cancelled") => void; onUnarchive: () => void }`; `TaskOpenAssignmentRows` gains `readOnly?: boolean` to suppress status selects (badge instead).

- [ ] **Step 1: Write the failing assertions (UI is covered by Task 12 e2e)**

Add to `e2e/task-filter.spec.ts` the frozen-view assertions described in Task 12 Step 1 now, then run them to confirm they fail because the menu items and read-only state do not exist yet: no Archive/Unarchive menu item, no "Mark as done"/"Mark as cancelled" dialog, status selects still render on archived rows. (Single e2e file is shared with Task 12; commit this task's slice of it here, then extend it in Task 12.)

- [ ] **Step 2: Implement the menu item component**

Create `components/projects/task-archive-menu-item.tsx`: one `DropdownMenuItem` labeled `t("projects.tasks.archiveTask")` (or `unarchiveTask` when `task.archived`), shown only when `canArchive`, with an `Archive`/`Archive` icon from `lucide-react`; clicking Archive opens a single `ActionConfirmDialog` (`projects.tasks.archive.title/message`) with the two actions `markDone`/`markCancelled` wired to `onArchive("done")`/`onArchive("cancelled")`. Unarchive has no dialog and calls `onUnarchive()` directly.

- [ ] **Step 3: Wire the table and freeze the archived row**

In `tasks-table.tsx`: add `onArchive(taskId, closeAs)` and `onUnarchive(taskId)` props; pass `children={<TaskArchiveMenuItem task={task} canArchive={canEdit} ... />}` into `ActionMenu`; pass no `onEdit` when `task.archived` (Edit hidden; Delete still shown). For archived rows: render priority as a plain span (not `TaskPrioritySelect`), pass `readOnly` to `TaskOpenAssignmentRows`, do not pass `onReopen` to `TaskClosedAssignmentRows`, and hide the comment button / disable `onDoubleClick`. `TaskHistoryPanel` stays available (read-only). In `task-open-assignment-rows.tsx`, add `readOnly?: boolean` and use it in the `allowed` computation (`readOnly ? null : getAllowedStatuses(...)`). In `tasks-card.tsx`, pass the two new callbacks from the store hooks.

- [ ] **Step 4: Fix the due-date fallback if the e2e assertion fails**

In `tasks-table.tsx:249-259`, if an archived task with all assignments closed shows a stale date, change `date={lead ? lead.endDate : task.endDate}` to prefer `task.endDate` whenever `open.length === 0` (archive sets it to today). Keep `overdue` false for frozen rows.

- [ ] **Step 5: Verify locally**

Run: `pnpm typecheck && pnpm eslint components/projects/task-archive-menu-item.tsx components/projects/tasks-table.tsx components/projects/task-open-assignment-rows.tsx components/projects/tasks-card.tsx --max-warnings=0`
Expected: PASS. E2E verification completes in Task 12.

- [ ] **Step 6: Commit** (after user permission)

```bash
git add components/projects/task-archive-menu-item.tsx components/projects/tasks-table.tsx components/projects/task-open-assignment-rows.tsx components/projects/tasks-card.tsx e2e/task-filter.spec.ts
git commit -m "feat(tasks): add archive menu and frozen archived rows"
```

---

### Task 12: E2E rewrite, seed integration, and full gate

**Files:**
- Modify: `e2e/task-filter.spec.ts` (rewrite), `lib/drizzle/seed-e2e.ts` (membership fixtures from Task 5)
- Audit (edit only where the superseded filter/save behavior breaks them): `e2e/multi-assignee.spec.ts`, `e2e/repeating-tasks.spec.ts`, `e2e/task-assignments.spec.ts`, `e2e/task-wizard-validation.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect`/`signInAs` from `./fixtures`; seeded `ROLES_PROJECT` ids; `TaskFilter` buttons labeled by `projects.tasks.open`/`archived` (spec table #10).
- Produces: an e2e suite that drives archive/unarchive and spawn behavior exclusively through the UI.

- [ ] **Step 1: Rewrite the filter spec**

Replace obsolete `"Unfinished"`/`"Finished"`/`"Both"`/`"Sin finalizar"`/`"Finalizadas"`/`"Ambas"` assumptions with `Open`/`Archived` (`Abiertas`/`Archivadas`) and add:

```ts
test("archive closes open work and hides the task from Open until unarchived", async ({ page }) => {
  // signInAs("admin"), create a repeating task with an assignee,
  // open the row menu → Archive → choose "Mark as done",
  // expect the row gone from Open, no successor created,
  // switch to Archived → row present, read-only (no status select / Reopen / Edit / comment input,
  // Delete present, due cell shows today), menu → Unarchive → row back under Open.
})
test("date-edit spawn opens only for active assignees", async ({ page }) => { /* zero-open repeating task → edit due date → one row for remaining member; removed assignee absent */ })
test("a removed project member never spawns on a later date change", async ({ page }) => { /* remove from project → date edit → no row for that user */ })
test("adding an assignee to a repeating task with an in-range date opens their assignment", async ({ page }) => { /* wizard add → row appears */ })
```

Keep/adapt the history-pagination, absorb, and collaborator cases from the old spec under the new labels; assert empty states per view and that the filter never auto-flips. Follow the menu-item locator pattern at `e2e/multi-assignee.spec.ts:151-154`.

- [ ] **Step 2: Audit the other specs**

Search those four specs for `"Unfinished"`, `"Finished"`, `"Both"`, `"Finalizadas"`, `"Sin finalizar"`, `"Ambas"`, and wizard-save-reopen expectations (superseded by Task 5). Change only assertions that depend on the removed three-way filter or the old "wizard reopens finished work" rule. Leave unrelated behavior pinned.

- [ ] **Step 3: Run the focused e2e suite**

Run: `pnpm test:e2e -- task-filter.spec.ts`
Expected: PASS (Docker test DB boots, migration applies, seed inserts membership rows, all archive/spawn/frozen assertions pass).

- [ ] **Step 4: Run the full gate**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS — typecheck, lint with zero warnings, unit tests with coverage floors, and the full Playwright suite including the audited specs.

- [ ] **Step 5: Commit** (after user permission)

```bash
git add e2e/task-filter.spec.ts e2e/multi-assignee.spec.ts e2e/repeating-tasks.spec.ts e2e/task-assignments.spec.ts e2e/task-wizard-validation.spec.ts lib/drizzle/seed-e2e.ts
git commit -m "test(tasks): cover archive, frozen rows and spawn triggers end to end"
```
