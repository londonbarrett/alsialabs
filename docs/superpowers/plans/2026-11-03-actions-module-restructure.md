# Actions Module Restructure (projects domain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the projects domain from the flat `actions/` folder into `actions/projects/` with a strict split between actions, queries, schemas, and utils — zero behavior change for callers.

**Architecture:** One folder per domain. `action.ts` carries `"use server"`; the `index.ts` barrel re-exports from it **without** the directive (Turbopack rejects any re-export in a `"use server"` file); every Drizzle call moves to `queries.ts`; Zod schemas merge into `schema.ts`; `verifyProjectAccess` becomes plain `resolveProjectAccess` in `util.ts` (no longer a browser-callable endpoint). Old flat files are deleted once the folder serves their imports.

**Tech Stack:** Next.js 16 App Router, next-safe-action, Drizzle ORM, Zod, Vitest (`vitest-drizzle-mock`), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-03-actions-module-restructure-design.md`

## Global Constraints

- Never commit or push without explicit user permission (AGENTS.md) — this plan contains no commit steps; ask before committing.
- Only `actions/projects/action.ts` may contain `"use server"`. `index.ts`, `queries.ts`, `schema.ts`, `util.ts` must never have it (Turbopack rejects re-exports from a `"use server"` file).
- `actions/projects/action.ts` must not import `@/lib/drizzle/client` or `drizzle-orm`.
- No exported safe-action may be renamed — call sites change import paths only.
- Action and query names follow `[action][subject]` plus a condition when needed: `getProjectById`, `createProjectMembership`, etc. Ship a CRUD operation only where it's used; never a delete-all.
- `messages/en.json` and `messages/es.json` untouched; no new translation keys (no user-facing strings change).
- Imports inside the module folder are relative (`./queries`); imports into the module from outside use `@/actions/projects/...`.
- After each task: `pnpm typecheck` must pass and the task's tests must pass before moving on.

## How to implement an action (rules)

**Authoritative rules live in `AGENTS.md` → the "Server Actions" section** (module layout, `"use server"` placement, query naming, action body order, schema/DTO conventions, client chains, imports, test placement, plus the action body template). It consolidates `docs/superpowers/specs/2026-10-16-safe-actions-design.md` (client chains, auth, metadata, revalidation) and `docs/superpowers/specs/2026-10-16-action-response-schemas-design.md` (output schemas, DTO inference). Follow AGENTS.md; the Global Constraints above restate only what this plan's tasks check directly.

## Review Focus

1. **Barrel + `"use server"`** — Turbopack rejects re-exports (both `export *` and named `export { x } from`) from a `"use server"` file. Pinned in Task 3 by `pnpm build`; resolved by dropping the directive from `index.ts` (server references come from `action.ts`).
2. **Circular import `lib/safe-action` → `actions/projects/util` → `queries`** — a cycle would fail at module init, often only at runtime. Pinned in Task 2 by running `actions/__tests__/safe-action.test.ts` (imports the chain) and in Task 3 by the full projects suite; `util.ts`/`queries.ts` must never import `@/lib/safe-action` or `./action`.
3. **vi.mock path drift** — a test mocking the old path while code imports the new path either fails loudly (real DB call) or silently stops intercepting. Pinned in Task 2 by a grep step asserting zero matches for `@/actions/legacy/not-safe/project-access` and `verifyProjectAccess` outside docs, plus the full unit suite.
4. **`getProjectContext` skips per-action output validation** — direct queries replace nested safe actions, so shape errors would surface only through the outer `ProjectContextSchema`. Pinned in Task 3 by new `getProjectContext` tests (happy path + FORBIDDEN) and by e2e project pages in Task 5.
5. **`getProjectForEdit` shares `getProjectById`** — the query now returns `categorySlug`/`categoryName`, which `ProjectRecordSchema` must strip (Zod default), not reject. Pinned in Task 3 by a new `getProjectForEdit` test asserting success and no `categorySlug` key in `result.data`.

---

### Task 1: Create `actions/projects/schema.ts`

**Files:**

- Create: `actions/projects/schema.ts`
- Modify: every importer of `@/actions/schemas/project` or `@/actions/schemas/project-membership` (list below)
- Delete: `actions/schemas/project.ts`, `actions/schemas/project-membership.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: every export of the two old schema files, at `@/actions/projects/schema`. Key names: `ProjectSchema`, `CreateProjectSchema`, `UpdateProjectSchema`, `ProjectRecordSchema`, `ProjectDetailSchema`, `ProjectOptionSchema`, `ProjectSummarySchema`, `ProjectContextSchema`, `ProjectSessionSchema`, `ProjectInProgressTaskSchema`, `ProjectPersonSchema`, `ProjectStatusSchema`, `ProjectAccessResultSchema`, plus membership exports `ProjectMemberRoleSchema`, `ProjectMembershipRoleSchema`, `ProjectMemberRowSchema`, `ProjectMembershipSchema`, `MemberInputSchema`, `SetMemberRoleSchema`, `TransferPrimaryOwnerSchema`, `ProjectPrimaryOwnerSchema`, and all `*DTO` types. No schema definitions change.

Importers to rewire (from grep; `import type` and value imports alike):

- `stores/projects/*` (use-projects-state.ts, use-projects-actions.ts, projects-store.ts, projects-reducer.ts, projects-store.test.ts)
- `stores/my-invoices/*` (my-invoices-reducer.ts, my-invoices-store.test.ts)
- `stores/project-context/*` (use-project-actions.ts, use-project-people-actions.ts, project-context-reducer.ts, project-context-store.ts, project-context-store.test.ts, use-project-context-state.ts)
- `components/projects/*` (project-card.tsx, projects-provider.tsx, project-context-provider.tsx, task-form-details-step.tsx, task-assignee-select.tsx)
- `actions/projects.ts`, `actions/project-membership.ts`
- `actions/__tests__/projects.test.ts`

- [ ] **Step 1: Create `actions/projects/schema.ts`**

Concatenate the two old files, membership schemas first (the project file imports `ProjectMemberRowSchema` from it). Keep every definition byte-identical; only the cross-file import of `ProjectMemberRowSchema` becomes a same-file reference. Keep `import { CategoryOptionSchema } from "@/actions/schemas/category"` and `import { PROJECT_COLORS } from "@/components/projects/colors"` as-is.

- [ ] **Step 2: Rewire all importers**

Replace `from "@/actions/schemas/project"` and `from "@/actions/schemas/project-membership"` with `from "@/actions/projects/schema"` across the list above. Use search-and-replace per file; do not alter import kinds (`import type` stays `import type`).

- [ ] **Step 3: Delete the two old schema files**

```bash
rm actions/schemas/project.ts actions/schemas/project-membership.ts
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck`
Expected: PASS (no unresolved `@/actions/schemas/project*` imports).

Run: `pnpm vitest run actions/__tests__/projects.test.ts actions/__tests__/project-membership.test.ts stores`
Expected: PASS.

---

### Task 2: Create `queries.ts` + `util.ts`, move project-access

**Files:**

- Create: `actions/projects/queries.ts`, `actions/projects/util.ts`
- Move: `actions/__tests__/project-access.test.ts` → `actions/projects/util.test.ts`
- Modify: `lib/safe-action.ts:8`, 8 test files (mock path/name), see list
- Delete: `actions/not-safe/project-access.ts`

**Interfaces:**

- Consumes: nothing from Task 1 (queries return raw rows; types are Drizzle-inferred).
- Produces (all in `actions/projects/queries.ts`, plain async, no `"use server"`):

```ts
getProjectOptions(userId: string)                    // rows exactly as getProjects returns today
getProjectSummaries(userId: string)                  // assembled array exactly as getProjectsWithDetails returns today (aggregates + mapping included)
getProjectById(projectId: string)                     // row | undefined, includes categorySlug/categoryName
createProject(values: CreateProjectDTO, primaryOwnerId: string)  // inserted row
updateProject(values: UpdateProjectDTO)               // updated row | undefined
deleteProject(projectId: string)                      // Promise<void>
getProjectPrimaryOwnerId(projectId: string)           // string | null
getProjectMembershipRole(projectId: string, userId: string)      // "admin" | "collaborator" | null
getProjectMembers(projectId: string)              // member rows, owner first; null if project missing
createProjectMembership(projectId: string, userId: string, role: "admin" | "collaborator")  // row | undefined
deleteProjectMembership(projectId: string, userId: string, role: "admin" | "collaborator")  // row | undefined
updateProjectMembershipRole(projectId: string, userId: string, role: "admin" | "collaborator") // row | undefined
transferProjectOwnership(projectId: string, currentOwnerId: string, newOwnerId: string)     // Promise<void> (the transaction)
```

And in `actions/projects/util.ts`:

```ts
resolveProjectAccess(projectId: string, userId: string): Promise<ProjectAccess>  // ProjectAccess from @/lib/project-roles
```

- Bodies are verbatim moves from `actions/projects.ts`, `actions/project-membership.ts`, and `actions/not-safe/project-access.ts`. Permission checks, `returnActionError`/`throwActionError`, and output shaping stay in the actions (still in their old files until Tasks 3–4) — queries return data or `undefined`/`null`.
- `queries.ts` may import `./schema` for DTO types; `util.ts` imports `./queries` only. Neither may import `@/lib/safe-action` or `./action`.

Test files whose `vi.mock("@/actions/legacy/not-safe/project-access")` must become `vi.mock("@/actions/projects/util")` with export `resolveProjectAccess` (and import/`vi.mocked` bindings renamed `verifyProjectAccess` → `resolveProjectAccess` where imported):

- `actions/__tests__/backups.test.ts` (mock only)
- `actions/__tests__/safe-action.test.ts` (mock only)
- `actions/__tests__/project-membership.test.ts`
- `actions/__tests__/expenses.test.ts`
- `actions/__tests__/projects.test.ts`
- `actions/__tests__/tasks.test.ts`
- `actions/__tests__/task-comments.test.ts`
- `actions/invoices.test.ts`

- [ ] **Step 1: Create `actions/projects/queries.ts`**

Extract each function per the inventory above from the three source files. Within `queries.ts`, keep the existing private helpers' logic (`getProjectPrimaryOwnerId` → `getProjectPrimaryOwnerId`, `getMembership` → `getProjectMembershipRole`). Import `CreateProjectDTO`/`UpdateProjectDTO` from `./schema` and Drizzle pieces from `@/lib/drizzle/*`.

- [ ] **Step 2: Create `actions/projects/util.ts`**

`resolveProjectAccess` orchestrates `getProjectPrimaryOwnerId` + `getProjectMembershipRole` with the exact owner → membership → deny logic currently in `verifyProjectAccess` (missing project → `{ hasAccess: false, role: null }`; owner match → `owner`; membership row → its role; else deny; super users get no override). No `"use server"`.

- [ ] **Step 3: Rewire `lib/safe-action.ts`**

Change line 8 to `import { resolveProjectAccess } from "@/actions/projects/util"` and update the call at line 150 (`const access = await resolveProjectAccess(...)`). Update the two comments referencing `verifyProjectAccess` (lines 84, 141).

- [ ] **Step 4: Update the 8 test files' mocks**

Path → `@/actions/projects/util`, export → `resolveProjectAccess`, rename import/`vi.mocked`/helper references (`grantAccess`, `grantRole` bodies use the new name).

- [ ] **Step 5: Move and rewrite `util.test.ts`**

```bash
mv actions/__tests__/project-access.test.ts actions/projects/util.test.ts
```

Update its import to `resolveProjectAccess` from `@/actions/projects/util`, rename the describe block to `resolveProjectAccess`. Test cases stay identical (owner/admin/collaborator/stranger/super-user/missing-project).

- [ ] **Step 6: Delete `actions/not-safe/project-access.ts`**

```bash
rm actions/not-safe/project-access.ts
```

- [ ] **Step 7: Grep for drift**

Run: `grep -rn "not-safe/project-access\|verifyProjectAccess" --include="*.ts" --include="*.tsx" actions lib stores components app e2e`
Expected: no matches (docs/ excluded by the paths).

- [ ] **Step 8: Verify**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm vitest run actions/__tests__/safe-action.test.ts actions/projects/util.test.ts actions/__tests__/projects.test.ts actions/__tests__/project-membership.test.ts actions/__tests__/tasks.test.ts actions/__tests__/expenses.test.ts actions/__tests__/task-comments.test.ts actions/__tests__/backups.test.ts actions/invoices.test.ts`
Expected: PASS.

---

### Task 3: Create `action.ts` + barrel, migrate projects actions

**Files:**

- Create: `actions/projects/action.ts`, `actions/projects/index.ts`
- Move: `actions/__tests__/projects.test.ts` → `actions/projects/projects.test.ts`
- Modify: none outside the folder (all `@/actions/projects` importers transparently resolve to the barrel after the delete)
- Delete: `actions/projects.ts`

**Interfaces:**

- Consumes: Task 1 (`./schema`), Task 2 (`./queries`, `./util` via `lib/safe-action`).
- Produces: barrel `@/actions/projects` exporting exactly the current public actions: `getProjects`, `getProjectsWithDetails`, `getProjectById`, `createProject`, `updateProject`, `getProjectForEdit`, `deleteProject`, `getProjectContext` — same signatures, input/output schemas, and metadata as today. Consumers: `app/app/proyectos/page.tsx`, `app/app/mis-facturas/page.tsx`, `app/app/proyectos/[id]/layout.tsx`, `stores/projects/use-projects-actions.ts`, `stores/project-context/use-project-actions.ts`, `components/projects/project-details.tsx`.

- [ ] **Step 1: Create `actions/projects/action.ts`**

`"use server"` at top. Port all 8 actions from `actions/projects.ts` with bodies rewritten to call `./queries` (no Drizzle imports). Specifically:

- `getProjects` → `return getProjectOptions(session.user.id)`
- `getProjectsWithDetails` → `return getProjectSummaries(session.user.id)`
- `getProjectById` → `const project = await getProjectById(projectId); if (!project) returnActionError("NOT_FOUND"); return project`
- `getProjectForEdit` → same query, `ProjectRecordSchema` output
- `createProject` → `return createProject(parsedInput, session.user.id)`
- `updateProject` → keep `canManageProject` check, then `const updated = await updateProject(parsedInput); if (!updated) returnActionError("NOT_FOUND"); return updated`
- `deleteProject` → `const ownerId = await getProjectPrimaryOwnerId(projectId); if (ownerId === null) returnActionError("NOT_FOUND"); if (!canManageProject(ctx.projectRole)) returnActionError("FORBIDDEN"); await deleteProject(projectId); return { success: true }` (preserves current NOT_FOUND-before-FORBIDDEN order)
- `getProjectContext` → direct queries, replacing the nested `getProjectById`/`getProjectMembers` calls:

```ts
if (!canViewProject(ctx.projectRole)) returnActionError("FORBIDDEN")
const project = await getProjectById(projectId)
if (!project) returnActionError("NOT_FOUND")
const [members, permissions, categoriesResult] = await Promise.all([
  getProjectMembers(projectId),
  getUserPermissions(session.user.id),
  getProjectCategories(),
])
if (!members) returnActionError("NOT_FOUND")
return {
  project,
  members,
  permissions,
  session,
  currentRole: ctx.projectRole!,
  currentUserId: session.user.id,
  categories: unwrapResponse(categoriesResult),
}
```

Drop the now-unused `unwrapResponse` import for members (keep it for categories) and the `getProjectMembers` import.

- [ ] **Step 2: Create `actions/projects/index.ts`**

Named re-exports of the 8 actions from `./action`, **no `"use server"` directive** (Turbopack rejects re-exports inside a `"use server"` file; `action.ts`'s directive is what marks them as server references):

```ts
export {
  getProjects,
  getProjectsWithDetails,
  getProjectById,
  createProject,
  updateProject,
  getProjectForEdit,
  deleteProject,
  getProjectContext,
} from "./action"
```

(Task 4 appends the 7 membership actions to this list.)

- [ ] **Step 3: Delete `actions/projects.ts`**

```bash
rm actions/projects.ts
```

(`@/actions/projects` now resolves to `actions/projects/index.ts`.)

- [ ] **Step 4: Move the projects test into the folder**

```bash
mv actions/__tests__/projects.test.ts actions/projects/projects.test.ts
```

Its imports of `@/actions/projects` and `@/actions/projects/schema` (Task 1) and `@/actions/projects/util` (Task 2) resolve as-is. Rename `mockVerifyProjectAccess` → `mockProjectResolveAccess` for consistency with the mock export.

- [ ] **Step 5: Add the three new tests to `actions/projects/projects.test.ts`**

Extend the `vi.mock("@/lib/auth", ...)` factory with `getUserPermissions: vi.fn()` and mock it `mockResolvedValue([])` in `beforeEach`. Add `vi.mock("@/actions/categories", () => ({ getProjectCategories: vi.fn() }))` resolving `{ data: [] }`.

1. `getProjectForEdit` — seed `state.mock.onSelect(schema.projectsTable).respond([makeProjectRow({ categorySlug: "dev", categoryName: "Dev" })])`; assert `result.serverError` undefined, `result.data.id === PROJECT_ID`, and `!("categorySlug" in result.data)`.
2. `getProjectContext` happy path — `grantAccess(true)` (role owner), seed project row, empty membership/users responses; assert `result.data.project.id`, `result.data.currentUserId`, `result.data.members` is an array, `result.data.categories` is an array.
3. `getProjectContext` FORBIDDEN — set `mockProjectResolveAccess.mockResolvedValue({ hasAccess: false, role: null })` and assert `result.serverError` equals `{ code: "FORBIDDEN" }`. (Both owner and collaborator roles pass `canViewProject`, so denial must come from `hasAccess: false`.)

- [ ] **Step 6: Build check for the barrel**

Run: `pnpm build`
Expected: PASS. (If it fails on the barrel, revisit Step 2 — the directive/re-export interaction is the known risk.)

- [ ] **Step 7: Verify**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm vitest run actions/projects`
Expected: PASS (moved suite + 3 new tests).

---

### Task 4: Migrate membership actions into `action.ts`

**Files:**

- Modify: `actions/projects/action.ts` (append), `stores/project-context/use-project-people-actions.ts`
- Move: `actions/__tests__/project-membership.test.ts` → `actions/projects/project-membership.test.ts`
- Delete: `actions/project-membership.ts`

**Interfaces:**

- Consumes: Task 2 queries (`getProjectPrimaryOwnerId`, `getProjectMembershipRole`, `getProjectMembers`, `createProjectMembership`, `deleteProjectMembership`, `updateProjectMembershipRole`, `transferProjectOwnership`).
- Produces: the 7 current membership actions appended to the barrel: `getProjectMembers`, `addProjectAdmin`, `removeProjectAdmin`, `addProjectCollaborator`, `removeProjectCollaborator`, `setProjectMemberRole`, `transferProjectPrimaryOwner` — unchanged signatures/schemas/metadata (`MEMBER_METADATA` moves with them). Consumer: `stores/project-context/use-project-people-actions.ts`.

- [ ] **Step 1: Append membership actions to `actions/projects/action.ts`**

Port all 7 actions from `actions/project-membership.ts`: permission checks and error mapping stay in the action; DB work calls `./queries`. Map the old private helpers: `getProjectPrimaryOwnerId` → `getProjectPrimaryOwnerId` (returns `null` → keep `throwActionError("NOT_FOUND")`), `getMembership` → `getProjectMembershipRole`. `getProjectMembers` → `const members = await getProjectMembers(projectId); if (members === null) throwActionError("NOT_FOUND"); return members`. `transferProjectPrimaryOwner` → ownership pre-checks in the action, then `await transferProjectOwnership(projectId, primaryOwnerId, newOwnerId); return { primaryOwnerId: newOwnerId }`. Move `MEMBER_METADATA` const. Import `throwActionError` from `@/lib/action-result` and the membership schemas from `./schema`.

- [ ] **Step 2: Rewire the store**

In `stores/project-context/use-project-people-actions.ts`, change `from "@/actions/project-membership"` → `from "@/actions/projects"`.

- [ ] **Step 3: Delete `actions/project-membership.ts`**

```bash
rm actions/project-membership.ts
```

- [ ] **Step 4: Move and update the membership test**

```bash
mv actions/__tests__/project-membership.test.ts actions/projects/project-membership.test.ts
```

Update the action import to `from "@/actions/projects"`. Imports of `@/actions/projects/util` and `@/actions/projects/schema` already point at the module.

- [ ] **Step 5: Grep for drift**

Run: `grep -rn "actions/project-membership\|actions/schemas/project" --include="*.ts" --include="*.tsx" actions lib stores components app e2e`
Expected: no matches.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm vitest run actions/projects`
Expected: PASS.

---

### Task 5: Full verification

**Files:** none created; fixes only if something fails.

- [ ] **Step 1: Grep for any leftover references to deleted modules**

Run: `grep -rn "not-safe/project-access\|verifyProjectAccess\|actions/schemas/project\b\|actions/schemas/project-membership\|actions/project-membership" --include="*.ts" --include="*.tsx" actions lib stores components app e2e`
Expected: no matches.

- [ ] **Step 2: Confirm the "use server" boundary**

Run: `grep -L '"use server"' actions/projects/queries.ts actions/projects/schema.ts actions/projects/util.ts && grep -l '"use server"' actions/projects/index.ts actions/projects/action.ts`
Expected: first command prints all three files (none have the directive); second prints both files that must have it.

- [ ] **Step 3: Run the full verification suite**

Run: `pnpm verify`
Expected: PASS — typecheck, `eslint --max-warnings=0`, vitest with coverage floors (60% lines/functions/statements, 50% branches).

- [ ] **Step 4: Run e2e**

Run: `pnpm test:e2e`
Expected: PASS (requires Docker; boots app on port 3100 with the test DB).

- [ ] **Step 5: Report to the user**

Summarize results and ask explicitly whether to commit (AGENTS.md forbids committing without permission).
