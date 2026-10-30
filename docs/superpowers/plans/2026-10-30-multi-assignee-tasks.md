# Project Roles, Repeating Tasks, and Assignments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace project ownership tables with owner/admin/collaborator membership, merge routines into `task`, and move per-person progress into `task_assignment` rows with repeating-task spawn.

**Architecture:** Additive-first. The new tables, columns, and view land without removing anything; then one surface at a time switches to them; a final migration drops the old columns and tables and truncates disposable data. Every task ends with a commit, and the pre-commit hook (`pnpm verify` + `pnpm test:e2e`) must pass before it, so no task leaves the repository red.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL + Drizzle ORM, next-safe-action + Zod, Zustand optimistic stores, next-intl, Vitest (`vitest-drizzle-mock`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-30-multi-assignee-tasks-design.md`

## Global Constraints

- Package manager is pnpm; never install dependencies without asking.
- Never hand-edit `drizzle/*.sql`, `drizzle/meta/_journal.json`, or snapshots. Schema DDL via `pnpm db:generate`; data statements via `pnpm db:generate --custom`.
- No `any` to work around type errors.
- **No commit before the user's review.** Each task ends with a green gate and a review request: run the gate, show the diff, and stop. Commit only after the user explicitly approves that task; nothing is ever pushed. Every `Commit` step below is therefore a review checkpoint, and its command runs only after approval. If the pre-commit hook fails, fix the code — never use `--no-verify`.
- Every task must leave `pnpm verify` and `pnpm test:e2e` green. The additive-first ordering exists for this reason: do not drop a column or table until the task that removes its last reader.
- `messages/en.json` and `messages/es.json` must stay structurally identical.
- Event handlers with two or more lines use `useCallback`; single-line handlers may stay inline.
- All list/mutation state lives in the page-scoped Zustand stores under `stores/`; no `useReducer` or list `useState` in components.
- Unit tests live beside the code (`actions/__tests__/*.test.ts`, `stores/**/*.test.ts`, `lib/**/*.test.ts`). E2E drives the pages through `e2e/fixtures.ts`.
- Deferred to a later phase: choosing several assignees in the UI, avatar stacks, progress summaries, expandable assignment rows. The schema, DTOs, and actions are multi-assignment capable from the start.

## Review Focus

- A non-repeating task whose window crosses midnight or ends before it starts — the schema must reject it, not silently store it.
- Duplicate ids in `assigneeIds` — creation must not violate the partial unique index or create two open rows for one person.
- A removed collaborator who still holds an **open** assignment — their My Tasks must not surface it, but their closed occurrences must remain visible.
- A repeat occurrence created after today's `startTime` has already passed — its first occurrence must land on the next valid slot, never in the past.
- A repeating task with an empty `time` — `computeScheduledFor` returns null and the cascade must not loop or insert a null-dated assignment.

---

### Task 1: Additive data model, view, and migration

**Files:**

- Modify: `lib/drizzle/schema.ts`
- Create: `drizzle/0024_*.sql` and `drizzle/meta/*` (generated)

**Interfaces:**

- Produces: `projectMembershipTable`, `taskAssignmentsTable`, `taskAssignmentDetailView`, `PROJECT_MEMBER_ROLES = ["admin","collaborator"] as const`, `type ProjectMemberRole`, `type TaskAssignment = typeof taskAssignmentsTable.$inferSelect`, `type ProjectMembership = typeof projectMembershipTable.$inferSelect`.
- Produces on `tasksTable` (all nullable unless noted): `startDate` (timestamp), `endDate` (timestamp), `recurrence`, `interval` (integer, not null, default 1), `daysOfWeek`, `startTime` (time), `endTime` (time). Everything existing stays untouched: `cost`, `status`, `assigneeId`, `routineId`, `dueDate`.

- [ ] **Step 1: Add the tables.** In `lib/drizzle/schema.ts` add, below `tasksTable`:

```ts
export const PROJECT_MEMBER_ROLES = ["admin", "collaborator"] as const
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number]

export const projectMembershipTable = pgTable(
  "project_membership",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: text().notNull().$type<ProjectMemberRole>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    check(
      "project_membership_role_check",
      sql`${table.role} in ('admin','collaborator')`
    ),
  ]
)

export const taskAssignmentsTable = pgTable(
  "task_assignment",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    taskId: text("task_id")
      .notNull()
      .references(() => tasksTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text().notNull().default("todo").$type<TaskStatus>(),
    comment: text(),
    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("task_assignment_open_unique")
      .on(table.taskId, table.userId)
      .where(sql`${table.status} not in ('done','cancelled')`),
    index("task_assignment_user_idx").on(table.userId),
  ]
)
```

- [ ] **Step 2: Add the task columns.** Inside `tasksTable`, after `dueDate`:

```ts
startDate: timestamp("start_date", { mode: "date" }),
endDate: timestamp("end_date", { mode: "date" }),
recurrence: text().$type<"daily" | "weekly" | null>(),
interval: integer().notNull().default(1),
daysOfWeek: text("days_of_week").array(),
startTime: time("start_time"),
endTime: time("end_time"),
```

- [ ] **Step 3: Declare the view** at the end of the file:

```ts
export const taskAssignmentDetailView = pgView(
  "task_assignment_detail"
).as((qb) =>
  qb
    .select({
      assignmentId: taskAssignmentsTable.id,
      taskId: tasksTable.id,
      userId: usersTable.id,
      status: taskAssignmentsTable.status,
      comment: taskAssignmentsTable.comment,
      startDate: taskAssignmentsTable.startDate,
      endDate: taskAssignmentsTable.endDate,
      taskName: tasksTable.name,
      taskDescription: tasksTable.description,
      taskPriority: tasksTable.priority,
      taskRecurrence: tasksTable.recurrence,
      projectId: tasksTable.projectId,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
    })
    .from(taskAssignmentsTable)
    .innerJoin(
      tasksTable,
      eq(taskAssignmentsTable.taskId, tasksTable.id)
    )
    .innerJoin(
      usersTable,
      eq(taskAssignmentsTable.userId, usersTable.id)
    )
)
```

- [ ] **Step 4: Generate the migration.**

Run: `pnpm db:generate`
Expected: a `0024_*.sql` with two `CREATE TABLE` statements, `ALTER TABLE "task" ADD COLUMN` × 7, and `CREATE VIEW "task_assignment_detail"`. No `DROP` statements.

- [ ] **Step 5: Verify the task commit gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: both pass.

- [ ] **Step 6: Review checkpoint — do not commit until the user approves.**

```bash
git add lib/drizzle/schema.ts drizzle/
git commit -m "feat(db): add task assignments, project membership, and recurring task fields"
```

---

### Task 2: Project role resolver and capability helpers

**Files:**

- Create: `lib/project-roles.ts`, `lib/project-roles.test.ts`
- Modify: `actions/not-safe/project-access.ts`
- Modify: `lib/safe-action.ts:140-179`
- Test: `actions/__tests__/project-access.test.ts` (new)

**Interfaces:**

- `type ProjectRole = "owner" | "admin" | "collaborator"`; `type ProjectAccess = { hasAccess: boolean; role: ProjectRole | null; isOwner: boolean }` — `isOwner` is a temporary compatibility flag equal to `role === "owner"`, removed in Task 8.
- `canViewProject(role)` (owner|admin), `canManageProject(role)` (owner), `canManageWork(role)` (owner|admin), `canManageAdmins(role)` (owner), `canManageCollaborators(role)` (owner|admin), `canChangeAnyAssignment(role)` (owner|admin), `isTerminalStatus(status)` (done|cancelled).
- `verifyProjectAccess(projectId: string, userId: string, _legacySessionRole?: string | null): Promise<ProjectAccess>` — the third parameter is accepted and ignored so existing call sites keep compiling; superusers get no override.
- ctx gains `projectRole: ProjectRole | null`; `ctx.isProjectOwner` stays, mapped to `role === "owner"` for now.

- [ ] **Step 1: Write the failing helper tests** in `lib/project-roles.test.ts`:

```ts
it("maps roles to capabilities", () => {
  expect([
    canViewProject("owner"),
    canViewProject("admin"),
    canViewProject("collaborator"),
    canViewProject(null),
  ]).toEqual([true, true, false, false])
  expect([
    canManageProject("owner"),
    canManageProject("admin"),
  ]).toEqual([true, false])
  expect([
    canManageWork("owner"),
    canManageWork("admin"),
    canManageWork("collaborator"),
  ]).toEqual([true, true, false])
  expect([canManageAdmins("owner"), canManageAdmins("admin")]).toEqual([
    true,
    false,
  ])
  expect([
    canManageCollaborators("owner"),
    canManageCollaborators("admin"),
    canManageCollaborators("collaborator"),
  ]).toEqual([true, true, false])
  expect([
    canChangeAnyAssignment("owner"),
    canChangeAnyAssignment("collaborator"),
  ]).toEqual([true, false])
})
it("treats done and cancelled as terminal", () => {
  expect(["done", "cancelled"].every(isTerminalStatus)).toBe(true)
  expect(isTerminalStatus("blocked")).toBe(false)
})
```

- [ ] **Step 2: Run it to confirm failure.**

Run: `pnpm vitest run lib/project-roles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/project-roles.ts`.**

- [ ] **Step 4: Write the failing resolver tests** in `actions/__tests__/project-access.test.ts`, mocking `@/lib/drizzle/client` like `actions/__tests__/projects.test.ts`:

```ts
it("returns owner for the primary owner", async () => {
  state.mock.onSelect(schema.projectsTable).respond([{ primaryOwnerId: USER_ID }])
  state.mock.onSelect(schema.projectMembershipTable).respond([])
  await expect(verifyProjectAccess(PROJECT_ID, USER_ID)).resolves.toEqual({ hasAccess: true, role: "owner", isOwner: true })
})
it("returns admin from membership", ...)        // { hasAccess: true, role: "admin", isOwner: false }
it("returns collaborator from membership", ...) // { hasAccess: true, role: "collaborator", isOwner: false }
it("returns no access for a stranger", ...)     // { hasAccess: false, role: null, isOwner: false }
it("grants no implicit super user access", ...) // primary owner is someone else, membership empty
```

- [ ] **Step 5: Run and verify failure.**

- [ ] **Step 6: Rewrite `verifyProjectAccess`** to load `primaryOwnerId`, then the membership row, returning owner first.

- [ ] **Step 7: Update `lib/safe-action.ts`** to call the resolver and inject `{ projectRole: access.role, isProjectOwner: access.isOwner }`.

- [ ] **Step 8: Update the shared test helpers.** `grantAccess(isOwner = true)` becomes `grantAccess(role: ProjectRole = "owner")` returning `{ hasAccess: true, role, isOwner: role === "owner" }`; `denyAccess()` returns `{ hasAccess: false, role: null, isOwner: false }`. Apply to `actions/__tests__/tasks.test.ts`, `projects.test.ts`, `expenses.test.ts`, `routines.test.ts`.

- [ ] **Step 9: Run the gate.**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 10: Review checkpoint — do not commit until the user approves.**

```bash
git add lib/project-roles.ts lib/project-roles.test.ts actions/not-safe/project-access.ts lib/safe-action.ts actions/__tests__ actions/schemas/project.ts
git commit -m "feat(projects): resolve project roles and expose them to actions"
```

---

### Task 3: Membership actions and schemas

**Files:**

- Create: `actions/schemas/project-membership.ts`
- Create: `actions/project-membership.ts`
- Test: `actions/__tests__/project-membership.test.ts` (new)

The existing `actions/project-people.ts` and `use-project-people-actions.ts` stay untouched so the app keeps working; Task 4 switches the consumers and deletes them.

**Interfaces:**

- `ProjectMemberRowSchema = { userId, userName|null, userEmail|null, userImage|null, role: ProjectRole, isPrimaryOwner: boolean }`.
- Actions, all `projectScopedAction`:
  - `getProjectMembers({ projectId })` → `ProjectMemberRowDTO[]` — owner first, then admins, then collaborators.
  - `addProjectAdmin({ projectId, userId })` → `ProjectMembershipDTO` — owner only; rejects the owner and existing admins (`ALREADY_OWNER`).
  - `removeProjectAdmin({ projectId, userId })` → `ProjectMembershipDTO` — owner only.
  - `addProjectCollaborator({ projectId, userId })` → `ProjectMembershipDTO` — owner or admin; rejects the owner and existing members (`ALREADY_COLLABORATOR`).
  - `removeProjectCollaborator({ projectId, userId })` → `ProjectMembershipDTO` — owner or admin.
  - `setProjectMemberRole({ projectId, userId, role })` → `ProjectMembershipDTO` — owner only.
  - `transferPrimaryOwner({ projectId, newOwnerId })` → `{ primaryOwnerId: string }` — owner only; target must be admin or collaborator; in one transaction: delete the target's membership row, insert the previous owner as `admin`, update `primary_owner_id`.

- [ ] **Step 1: Write the failing tests** covering: admin adds/removes a collaborator; admin cannot add, remove, or change an admin (`FORBIDDEN`); owner can; duplicate member returns `ALREADY_COLLABORATOR`; transfer promotes the target and demotes the old owner to admin; transfer to a stranger returns `MUST_BE_OWNER`.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement the schemas and actions.** Guard with `canManageAdmins(ctx.projectRole)` and `canManageCollaborators(ctx.projectRole)`.

- [ ] **Step 4: Run the gate.**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/schemas/project-membership.ts actions/project-membership.ts actions/__tests__/project-membership.test.ts
git commit -m "feat(projects): add membership actions for admins and collaborators"
```

---

### Task 4: Project context, stores, and people UI

**Files:**

- Modify: `actions/schemas/project.ts` (`ProjectContextSchema`, `ProjectSummarySchema` person fields)
- Modify: `actions/projects.ts` (`getProjectContext`, `getProjectsWithDetails` people sections)
- Modify: `stores/project-context/*` (reducer, store types, state hook, `use-project-people-actions.ts`)
- Modify: `components/projects/project-people.tsx`
- Delete: `actions/project-people.ts`, `actions/schemas/project-people.ts` (confirm before deleting)
- Modify consumers of `useProjectContextState`: `components/projects/project-details.tsx`, `tasks-card.tsx`, `tasks-table.tsx`, `project-expenses.tsx`, `routines/routines-view.tsx`, `routines/routine-form.tsx`, `project-view.tsx`
- Test: `stores/project-context/project-context-store.test.ts`

**Interfaces:**

- `ProjectContextDTO = { project, members: ProjectMemberRowDTO[], permissions: string[], session, currentRole: ProjectRole, currentUserId: string, categories }`.
- `useProjectContextState()` → `{ project, projectId, members, currentRole, currentUserId, isOwner, isAdmin, isCollaborator, categories }` where each flag is `currentRole === "..."`. The old `owners`, `collaborators`, `primaryOwner`, `additionalOwners`, `isCurrentUserAdmin`, `isPrimaryOwner` disappear.
- `useProjectPeopleActions()` → `addAdmin(userId)`, `removeAdmin(userId)`, `addCollaborator(userId)`, `removeCollaborator(userId)`, `setRole(userId, role)`.
- Consumers map old gates: `isOwner && canEditProject` → `(isOwner || isAdmin) && canEditProject`; project-detail edit/delete stays `isOwner`; collaborator status checks use `isCollaborator`.

- [ ] **Step 1: Write the failing reducer tests** for `addMember`, `removeMember`, `setMemberRole`, and `patchProject`; assert the primary owner cannot be added or removed.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Update the DTO, reducer, store types, state hook, and actions hook.**

- [ ] **Step 4: Rewrite `project-people.tsx`** as one member list with role badges; "Add admin" only under `canManageAdmins(currentRole)`, "Add collaborator" and collaborator removal under `canManageCollaborators(currentRole)`, role change under `canManageAdmins(currentRole)`.

- [ ] **Step 5: Update `getProjectContext`** to call `getProjectMembers`, derive `currentRole` from `verifyProjectAccess`, and reject collaborators with `FORBIDDEN` when `canViewProject` is false.

- [ ] **Step 6: Update the consumers listed under Files** so typecheck passes; keep behaviour otherwise identical.

- [ ] **Step 7: Delete the old people actions after confirming with the user**, then remove every import.

- [ ] **Step 8: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 9: Review checkpoint — do not commit until the user approves.**

```bash
git add -A
git commit -m "feat(projects): switch project context and UI to membership roles"
```

---

### Task 5: Projects list filtering, route gate, and expense guards

**Files:**

- Modify: `actions/projects.ts` (`getProjects`, `getProjectsWithDetails`, `createProject`, `deleteProject`)
- Modify: `actions/expenses.ts` (all five actions)
- Modify: `app/app/proyectos/page.tsx` (drop the `projects:view` gate; `auth()` stays)
- Modify: `components/projects/projects-view.tsx` (empty-state copy only if needed)
- Test: `actions/__tests__/projects.test.ts`, `actions/__tests__/expenses.test.ts`

**Interfaces:**

- `getProjects` / `getProjectsWithDetails`: filter with `or(eq(projectsTable.primaryOwnerId, userId), exists(membership for userId))`, no superuser branch.
- `createProject`: insert the project only; no owner-table insert.
- `deleteProject`: `canManageProject(ctx.projectRole)`.
- `getExpensesByProjectId`: `canViewProject(ctx.projectRole)`; the three mutations: `canManageWork(ctx.projectRole)`.

- [ ] **Step 1: Update the failing expectations.** Projects: a collaborator-only project is absent; an admin-membership project is present; a superuser with no membership sees an empty list; `createProject` inserts no owner row. Expenses: a collaborator gets `FORBIDDEN` from the read and the three mutations.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement the filtering, guards, and page change.**

- [ ] **Step 4: Run the gate.**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/projects.ts actions/expenses.ts app/app/proyectos/page.tsx components/projects/projects-view.tsx actions/__tests__
git commit -m "feat(projects): scope the project list and actions to owner and admin roles"
```

---

### Task 6: Task schemas and recurrence helper

**Files:**

- Modify: `actions/schemas/task.ts` (additive — keep the old `TaskSchema`/`TaskRecordSchema` for routines until Task 12)
- Create: `lib/tasks/recurrence.ts`, `lib/tasks/recurrence.test.ts`
- Test: `actions/__tests__/task-schemas.test.ts` (new)

**Interfaces:**

- `TaskFormSchema`: `name`, `description`, `priority` (nullable), `assigneeIds: z.array(z.string().min(1)).default([])`, `startDate`/`endDate` (ISO strings, nullable), `recurrence: z.enum(["daily","weekly"]).nullable().optional()`, `interval: z.coerce.number().int().min(1).max(365).default(1)`, `daysOfWeek: z.array(z.string()).default([])`, `startTime`/`endTime` (strings, default `""`).
- Refinements: non-repeating requires `startDate` and `endDate`, `endDate >= startDate`, and both on the same calendar day; repeating requires `startTime`.
- `CreateTaskV2Schema = TaskFormSchema.extend({ projectId: z.uuid() })`, `UpdateTaskV2Schema = TaskFormSchema.extend({ projectId: z.uuid(), taskId: z.uuid() })`.
- DTO schemas: `TaskAssignmentSchema`, `TaskRecordV2Schema`, `TaskWithAssignmentsSchema`, `MyTaskSchema`, `AssignmentStatusResultSchema = { assignment, nextAssignment: nullable }` plus their inferred types, exactly as specified.
- `computeNextOccurrence(task: Pick<Task, "recurrence"|"interval"|"daysOfWeek"|"startTime">, after: Date): Date | null` — null when recurrence is null, `startTime` is empty, or `computeScheduledFor` is null; otherwise the next occurrence date.

- [ ] **Step 1: Write the failing recurrence tests**, including the Review Focus cases (empty `startTime` returns null; an anchor later than today's `startTime` moves to the next slot, never the past).

- [ ] **Step 2: Write the failing schema tests**, including the Review Focus midnight case and `endDate < startDate`.

- [ ] **Step 3: Run and verify failure.**

- [ ] **Step 4: Implement the schemas and `lib/tasks/recurrence.ts`.**

- [ ] **Step 5: Run the gate.**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 6: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/schemas/task.ts actions/__tests__/task-schemas.test.ts lib/tasks/recurrence.ts lib/tasks/recurrence.test.ts
git commit -m "feat(tasks): add assignment DTOs and recurrence scheduling"
```

---

### Task 7: Task CRUD and project task list with assignments

This is the largest task; it swaps the whole project-tasks surface in one commit so the gate stays green. Repetition is not wired yet — every task is treated as non-repeating.

**Files:**

- Create: `lib/tasks/assignments.ts` (row → DTO mapper, assignee validation)
- Modify: `actions/schemas/task.ts` (add a temporary `cost` field to `TaskFormSchema` and `TaskRecordV2Schema`, removed in Task 11)
- Rewrite: `actions/tasks.ts` (queries, create, update, priority, delete, and `updateAssignmentStatus` without the cascade; `updateTaskStatus` stays until Task 8 so routine spawning keeps compiling)
- Rewrite: `stores/project-tasks/*`
- Rewrite: `components/projects/task-form.tsx`, `task-dialog.tsx`, `tasks-card.tsx`, `tasks-table.tsx`
- Modify: `components/projects/expenses/project-expenses.tsx` (build the optimistic task in the new shape, keep using `cost`)
- Create: `components/projects/task-assignee-select.tsx`
- Modify: `components/projects/task-status-select.tsx` (caller supplies statuses; no change to the component API)
- Test: `actions/__tests__/tasks.test.ts`, `stores/project-tasks/project-tasks-store.test.ts`

**Interfaces:**

- `getTasks({ projectId })` → `TaskWithAssignmentsDTO[]`; requires `canViewProject`; assignments loaded from `taskAssignmentDetailView` and grouped in memory; comment counts as today. `cost` is selected for the expenses screen until Task 11.
- `createTask(CreateTaskV2Schema)` → `TaskWithAssignmentsDTO`; `canManageWork`; collapse duplicate ids; validate each id is the owner or a membership row; insert task + assignment rows in one transaction; for a non-repeating task copy `startDate`/`endDate` onto each assignment as `start_date`/`end_date`.
- `updateTask(UpdateTaskV2Schema)`: update task columns; diff open assignments by `user_id`; insert new rows with copied dates; delete removed open rows; never update existing assignment values.
- `updateAssignmentStatus({ assignmentId, status })` → `AssignmentStatusResultDTO`: owner/admin any status; otherwise the caller must own the row, it must be open, and the status must be in `COLLABORATOR_TASK_STATUSES`. Returns `nextAssignment: null` in this task; Task 8 adds the cascade.
- `updateTaskPriority`, `deleteTask`: `canManageWork`.
- Store state `{ tasks: TaskWithAssignmentsDTO[], commentsByTask }`; actions `addTask`, `updateTask`, `replaceTempTask`, `deleteTask`, `updateAssignment`, `updateTaskPriority`, comment actions.
- `TaskFormValues` (exported from `task-dialog.tsx`): `{ name, description, priority, assigneeIds: string[], startDate: string|null, endDate: string|null }`.
- `TaskAssigneeSelect`: single-select over `members` showing avatar, name, email; `""` = unassigned.
- Task table: no cost column, no status field on the form; status control reads/writes `task.assignments[0]`; date comes from the open assignment; allowed statuses from a helper `getAssignmentAllowedStatuses(assignment, role, currentUserId)` (owner/admin → all; collaborator owning an open row → `COLLABORATOR_TASK_STATUSES`; otherwise null).

- [ ] **Step 1: Write the failing action tests** for `getTasks` (assignment grouping), `createTask` (one row per id, duplicates collapsed, dates copied), `updateTask` (add/remove diff, closed rows untouched), `updateAssignmentStatus` (collaborator own/open/limited; admin any), guards (collaborator `FORBIDDEN`), and same-day validation.

- [ ] **Step 2: Write the failing store tests** for add/update/delete/replaceTemp/priority/assignment-status.

- [ ] **Step 3: Run and verify failure.**

- [ ] **Step 4: Implement `lib/tasks/assignments.ts` and the actions.**

- [ ] **Step 5: Implement the store.**

- [ ] **Step 6: Rewrite the task form, dialog, card, and table.** The form is single-step in this task; Task 8 adds the repeat step and the wizard.

- [ ] **Step 7: Adapt the expenses screen** so its optimistic task carries `assignments` and the temporary `cost`.

- [ ] **Step 8: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 9: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/tasks.ts actions/schemas/task.ts lib/tasks/assignments.ts actions/__tests__/tasks.test.ts stores/project-tasks components/projects/task-form.tsx components/projects/task-dialog.tsx components/projects/tasks-card.tsx components/projects/tasks-table.tsx components/projects/task-assignee-select.tsx components/projects/task-status-select.tsx components/projects/expenses/project-expenses.tsx
git commit -m "feat(tasks): track per-person assignments with their own status and dates"
```

---

### Task 8: Assignment comments, repeat cascade, and the task wizard

**Files:**

- Modify: `actions/tasks.ts` (remove `updateTaskStatus`; add the cascade to `updateAssignmentStatus`; add `updateAssignmentComment`)
- Modify: `stores/project-tasks/*` (next-occurrence insertion, comment edits)
- Create: `components/projects/task-step-indicator.tsx`, `task-form-repeat-step.tsx`
- Modify: `components/projects/task-form.tsx`, `task-dialog.tsx`, `tasks-card.tsx`, `tasks-table.tsx`
- Test: `actions/__tests__/task-assignments.test.ts` (new), `stores/project-tasks/project-tasks-store.test.ts`

**Interfaces:**

- `updateAssignmentStatus` gains the cascade: reaching `done`/`cancelled` on a repeating task computes the next occurrence with `computeNextOccurrence` and inserts the new assignment in the same transaction, returning it as `nextAssignment`.
- `updateAssignmentComment({ assignmentId, comment })` → `TaskAssignmentDTO`: same ownership rule as the status action; trims; empty → null.
- Wizard: `step`/`step1Done` exactly like the routine form; step 1 = name, description, priority, assignee, start/end datetimes; step 2 = a "Repeat this task" switch revealing recurrence, interval, weekdays, time, start date, end date.
- `TaskFormValues` becomes `{ name, description, priority, assigneeIds, startDate, endDate, recurrence: "daily"|"weekly"|null, interval: number, daysOfWeek: string[], startTime: string, endTime: string }`.
- Task table shows a recurring `Badge` when `task.recurrence !== null`.

- [ ] **Step 1: Write the failing action tests** for: collaborator `in_progress` on their open row; collaborator rejected on `done`; rejected after terminal; admin sets someone else's `done`; admin comment edit; stranger `FORBIDDEN`; cascade inserts exactly one row; non-repeating spawns nothing.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement the two actions and the cascade.**

- [ ] **Step 4: Update the store for comment edits and spawned rows.**

- [ ] **Step 5: Build the wizard** and add the repeat step + badge.

- [ ] **Step 6: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 7: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/tasks.ts actions/__tests__/task-assignments.test.ts stores/project-tasks components/projects/task-form.tsx components/projects/task-dialog.tsx components/projects/tasks-card.tsx components/projects/tasks-table.tsx components/projects/task-step-indicator.tsx components/projects/task-form-repeat-step.tsx
git commit -m "feat(tasks): let assignees own their status and spawn repeating occurrences"
```

---

### Task 9: Calendar driven by assignments

This comes before My Tasks because the calendar page currently consumes `getMyTasks`; moving it first lets Task 10 change that action freely.

**Files:**

- Modify: `actions/schemas/calendar.ts`, `actions/not-safe/calendar.ts`
- Modify: `lib/calendar/util/events.ts`, `lib/calendar/util/events.test.ts`
- Modify: `lib/types.ts` (`CalendarEventMeta`)
- Modify: `components/calendar/calendar-view.tsx`, `event-detail-dialog.tsx`
- Modify: `app/app/calendario/page.tsx` (stop importing `getMyTasks`)
- Test: `lib/calendar/util/events.test.ts`, `actions/__tests__/calendar.test.ts` (new)

**Interfaces:**

- `getCalendarAssignments({ from?, to? })` → `CalendarAssignmentDTO[]`: rows from `taskAssignmentDetailView`, visible when the caller holds the assignment or is owner/admin on the project; no superuser branch. `getCalendarTasks` and `getCalendarRoutines` are removed; the routines query is deleted here.
- `CalendarAssignmentDTO = { assignmentId, taskId, taskName, status, priority, startDate, endDate, projectId, projectName, projectColor, projectOwnerName|null, userName|null, userImage|null, commentCount, recurrence|null }`.
- `buildCalendarEvents(assignments, from, to)` groups by `taskId` + `startOfDay(startDate)`; `meta.assignees: { name, image, status, comment }[]`.
- Event detail lists each assignment's person, status, and note.

- [ ] **Step 1: Write the failing event-builder test** (two same-day assignments of one task → one event; different days → two events) and the failing visibility test (`actions/__tests__/calendar.test.ts`).

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement the query, builder, view, and dialog.**

- [ ] **Step 4: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 5: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/not-safe/calendar.ts actions/schemas/calendar.ts actions/__tests__/calendar.test.ts lib/calendar lib/types.ts components/calendar app/app/calendario/page.tsx
git commit -m "feat(calendar): render assignments grouped by task and day"
```

---

### Task 10: My Tasks with active and past assignments

**Files:**

- Modify: `actions/tasks.ts` (`getMyTasks`)
- Modify: `actions/task-comments.ts` (assignment-based access; moderation via `canManageWork`)
- Modify: `actions/schemas/task-comment.ts` only if required
- Modify: `stores/my-tasks/*`
- Modify: `components/my-tasks/*`
- Modify: `app/app/mis-tareas/page.tsx` (new `getMyTasks()` shape, drop `isSuperUser`)
- Test: `actions/__tests__/my-tasks.test.ts`, `actions/__tests__/task-comments.test.ts`, `stores/my-tasks/my-tasks-store.test.ts`

**Interfaces:**

- `getMyTasks()` → `{ active: MyTaskDTO[], past: MyTaskDTO[] }`. Active = open assignments on projects where the caller is owner/admin/collaborator. Past = terminal assignments **including** projects the caller no longer belongs to.
- Comment access: `canViewProject(role)` or the caller holds an open assignment on the task.
- Store state `{ active, past, commentsByTask }`; `updateAssignment` moves a row between the two lists when status crosses the terminal boundary; `insertNextAssignment` adds to `active`.
- `MyTasksView` takes `currentUserId` only; two sections, past read-only; no cost column.

- [ ] **Step 1: Write the failing tests**, including the Review Focus case: a removed collaborator's open assignment is absent from `active`, and their closed assignment is in `past`.

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Implement `getMyTasks`, the comment access, the store, and the UI.**

- [ ] **Step 4: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 5: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/tasks.ts actions/task-comments.ts actions/__tests__/my-tasks.test.ts actions/__tests__/task-comments.test.ts stores/my-tasks components/my-tasks app/app/mis-tareas/page.tsx
git commit -m "feat(my-tasks): split assignments into active and past"
```

---

### Task 11: Remove task costs

**Files:**

- Modify: `actions/projects.ts` (drop `taskCostAggs`, `taskCostMap`, and the task-cost term of the spend total)
- Modify: `components/projects/expenses/project-expenses.tsx`, `expenses-table.tsx`
- Modify: `components/projects/tasks-table.tsx`, `components/my-tasks/my-tasks-list.tsx` (drop the cost columns — no-ops if Task 7/9 already removed them)
- Modify: `lib/types.ts`, `lib/calendar/util/events.ts`, `components/calendar/event-detail-dialog.tsx` (drop `cost`)
- Test: `actions/__tests__/projects.test.ts`

**Interfaces:**

- Project spend = expenses + paid invoices only.
- `CombinedExpenseRow` loses the `task` variant; the expenses screen lists expenses and invoices only.
- `CalendarEventMeta` has no `cost`.

- [ ] **Step 1: Update the failing aggregate test** (spend ignores tasks; no `cost` reference).

- [ ] **Step 2: Run and verify failure.**

- [ ] **Step 3: Remove the code paths.**

- [ ] **Step 4: Run the gate.**

Run: `pnpm verify`
Expected: PASS.

- [ ] **Step 5: Review checkpoint — do not commit until the user approves.**

```bash
git add actions/projects.ts components/projects/expenses components/projects/tasks-table.tsx components/my-tasks/my-tasks-list.tsx lib/types.ts lib/calendar components/calendar actions/__tests__/projects.test.ts
git commit -m "refactor: remove task costs and their aggregates"
```

---

### Task 12: Delete the routines surface

**Files:**

- Delete (confirm with the user before running the deletion): `actions/routines.ts`, `actions/schemas/routine.ts`, `lib/routines/`, `stores/routines/`, `components/projects/routines/`, `app/app/proyectos/[id]/rutinas/page.tsx`
- Modify: `components/projects/project-view.tsx` (remove the rutinas tab)
- Modify: `lib/types.ts` (remove `RoutineSubmitData`)
- Modify: `lib/safe-action.ts`, `actions/not-safe/project-access.ts`, `actions/schemas/project.ts` (remove the `isOwner` compatibility field; every remaining reader is gone once routines are deleted)
- Modify: `messages/en.json`, `messages/es.json` (remove routine-only keys; keep shared schedule labels used by the repeat step)
- Modify: `actions/__tests__/routines.test.ts` (delete)
- Test: `pnpm verify`

- [ ] **Step 1: Ask the user to confirm the deletions** listed above. Wait for approval.

- [ ] **Step 2: Delete the files and remove every import, the tab, and the keys.**

- [ ] **Step 3: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 4: Review checkpoint — do not commit until the user approves.**

```bash
git add -A
git commit -m "refactor(tasks): remove the routines surface now that tasks repeat in place"
```

---

### Task 13: Destructive migration — drop old columns and tables

**Files:**

- Modify: `lib/drizzle/schema.ts` (drop `tasksTable.cost`, `status`, `assigneeId`, `routineId`, `dueDate`; drop `routinesTable`, `projectOwnersTable`, `projectCollaboratorsTable` and their types)
- Create: `drizzle/0025_*.sql` and `drizzle/0025_*_truncate.sql` (generated)
- Modify: `lib/drizzle/seed-e2e.ts` if it references removed tables (it should not)
- Test: the migration plus the full gate

**Interfaces:**

- Remaining `task` columns: `id`, `projectId`, `name`, `description`, `priority`, `startDate`, `endDate`, `recurrence`, `interval`, `daysOfWeek`, `startTime`, `endTime`, `createdAt`, `updatedAt`.
- No code references the removed tables or columns; typecheck proves it.

- [ ] **Step 1: Remove the columns, tables, and exported types from the schema.**

- [ ] **Step 2: Generate the DDL.**

Run: `pnpm db:generate`
Expected: `0025_*.sql` with the `DROP COLUMN` and `DROP TABLE` statements.

- [ ] **Step 3: Add the data reset.**

Run: `pnpm db:generate --custom --name truncate_disposable_data`
Fill with:

```sql
TRUNCATE TABLE "task" CASCADE;
```

If the drop migration already removes the old tables, keep only the `TRUNCATE`.

- [ ] **Step 4: Apply to the test database.**

Run: `pnpm test:db:setup`
Expected: migrations apply and the seed exits 0.

- [ ] **Step 5: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 6: Review checkpoint — do not commit until the user approves.**

```bash
git add lib/drizzle/schema.ts drizzle/
git commit -m "refactor(db): drop legacy task columns and ownership tables"
```

---

### Task 14: E2E coverage for roles, assignments, and repetition

**Files:**

- Modify: `lib/drizzle/seed-e2e.ts`
- Create: `e2e/project-roles.spec.ts`, `e2e/task-assignments.spec.ts`, `e2e/repeating-tasks.spec.ts`
- Modify: `messages/en.json`, `messages/es.json` (final labels)
- Test: the specs themselves

**Interfaces:**

- `seed-e2e.ts` creates, with fixed UUIDs and an idempotent delete-by-id first: one project owned by `admin@test.local`, `user1@test.local` as admin, `user2@test.local` and `user3@test.local` as collaborators, one non-repeating task assigned to `user2`, and one weekly repeating task assigned to `user2`.
- New keys: `projects.roles.owner|admin|collaborator`, `projects.tasks.recurring`, `projects.tasks.repeat`, `projects.tasks.stepDetails`, `projects.tasks.stepRepeat`, `projects.tasks.assignmentNote`, `myTasks.active`, `myTasks.past`.

- [ ] **Step 1: Add the translation keys to both files.**

- [ ] **Step 2: Update `seed-e2e.ts`** and run `pnpm test:db:setup`.

- [ ] **Step 3: Write `e2e/project-roles.spec.ts`**: owner adds a collaborator; the collaborator opens the projects section and does not see the project; the project URL is forbidden; an admin manages tasks but cannot edit project details, delete the project, or change an admin.

- [ ] **Step 4: Write `e2e/task-assignments.spec.ts`**: collaborator sees the task in My Tasks, sets `in_progress`, cannot select `done`; owner sets it `done`; it moves to Past and is read-only.

- [ ] **Step 5: Write `e2e/repeating-tasks.spec.ts`**: the list shows the recurring badge; completing an occurrence adds the next to Active and leaves the old one in Past.

- [ ] **Step 6: Run the gate.**

Run: `pnpm verify && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 7: Review checkpoint — do not commit until the user approves.**

```bash
git add e2e lib/drizzle/seed-e2e.ts messages/
git commit -m "test(e2e): cover project roles, assignments, and repeating tasks"
```

---

### Task 15: Branch review

- [ ] **Step 1: Review the branch.**

Run: `git log --oneline` and `git diff --stat <base>..HEAD`. Read the full diff for accidental secrets, `.env` changes, or scope creep.

- [ ] **Step 2: Request a fresh review** using the `requesting-code-review` skill.

- [ ] **Step 3: Report to the user** with the verified command output and the list of deleted files. Do not push.
