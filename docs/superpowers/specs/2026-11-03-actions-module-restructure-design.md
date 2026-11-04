# Actions module restructure — Design

## Why this exists

The `actions/` folder is flat: every domain is one large file (`actions/projects.ts` is 545 lines, `actions/invoices.ts` 779) with safe-action definitions, Drizzle queries, and orchestration interleaved. Roughly 75 direct `db` call sites live across action files. It has become hard to tell what an action does at a glance, and queries cannot be reused or reviewed independently. This capability restructures one domain per session into a module folder with a strict separation between entry points (actions), data access (queries), validation (schemas), and plain helpers (util).

The projects domain goes first. Remaining domains migrate in later sessions following the same pattern.

## Goals

- One folder per domain under `actions/<domain>/` containing exactly: `index.ts`, `actions.ts`, `queries.ts`, `schemas.ts`, `util.ts`, plus beside-file tests. Shared non-DTO types live in `lib/types.ts`.
- **No direct DB queries inside actions.** Every Drizzle call for the domain lives in `queries.ts`.
- **Only `actions.ts` carries `"use server"`; `index.ts`, `queries.ts`, `schemas.ts`, and `util.ts` must never have it** — on `queries.ts`/`util.ts` it would expose every export as a client-callable endpoint (this is how `verifyProjectAccess` currently leaks a role-probe endpoint from `actions/not-safe/project-access.ts`); on `index.ts` Turbopack rejects re-exports from a `"use server"` file outright.
- Action and query names follow `[action][subject]` plus a condition when needed (e.g. `getProjectById`, `createProjectMembership`); CRUD operations ship only where used, and there are never delete-all operations.
- The projects domain includes `projects.ts`, `project-membership.ts`, `schemas/project.ts`, `schemas/project-membership.ts`, and `not-safe/project-access.ts`.
- Zero behavior change for callers: action export names stay identical; only import paths change.

## Non-goals

- Migrating any other domain (clients, tasks, invoices, categories, …) — later sessions.
- Changing auth, permission, or revalidation semantics of any action.
- Moving or changing `lib/safe-action.ts`'s `projectAction` factory itself — only its `verifyProjectAccess` dependency moves.
- Relocating tests for other domains; their files stay put and only mock paths update.
- Barrel-exports for schemas/queries/util — the barrel exports actions only.

## Anti-goals

- A `"use server"` directive on `index.ts`, `queries.ts`, `schemas.ts`, or `util.ts`.
- `actions.ts` importing `@/lib/drizzle/client` or `drizzle-orm`.
- Renaming any exported action (clients would churn beyond import paths).
- A circular import: `lib/safe-action.ts` → `actions/projects/util.ts` → `queries.ts` → Drizzle. Nothing on that path may import `lib/safe-action.ts`.
- Calling sibling safe actions from within an action when a same-module query exists (today `getProjectContext` wraps `getProjectById`/`getProjectMembers` and unwraps them).

## Target layout

```
actions/projects/
├── index.ts                    # barrel: named re-exports from ./action; NO "use server"
├── actions.ts                  # "use server"; all safe actions for the domain
├── queries.ts                  # every Drizzle call; plain module
├── schemas.ts                   # merged schemas/project.ts + schemas/project-membership.ts
├── util.ts                     # plain helpers (resolveProjectAccess)
├── projects.test.ts            # moved from actions/__tests__/projects.test.ts
├── project-membership.test.ts  # moved from actions/__tests__/
└── util.test.ts                # moved from actions/__tests__/project-access.test.ts
```

### `index.ts`

Named re-exports of the domain's actions from `./actions`, with **no `"use server"` directive** (Turbopack rejects re-exports inside a `"use server"` file; `actions.ts`'s directive marks them as server references). Nothing else is re-exported. Existing imports of `@/actions/projects` keep resolving (folder + barrel) with no call-site changes. `@/actions/project-membership` imports switch to `@/actions/projects`.

### `actions.ts`

All safe actions from `actions/projects.ts` and `actions/project-membership.ts`, unchanged in name, input schema, output schema, metadata, and error codes. Bodies become orchestration only: permission checks (`canManageProject`, etc.), calls into `queries.ts` / `util.ts`, shaping return values. `getProjectContext` calls `getProjectById` and `getProjectMembers` directly instead of the `getProjectById`/`getProjectMembers` safe actions (dropping `unwrapResponse` for those two); it still calls `getProjectCategories()` (categories domain, not yet migrated) and `getUserPermissions()`.

### `queries.ts`

Plain async functions, no `"use server"`, the only place in the domain that imports `@/lib/drizzle/client` and `drizzle-orm`. **A leaf query is exactly one DB call; a composed query contains zero direct `db` calls and only calls other queries** (the sole exception is `db.transaction(...)`, one atomic unit). Inventory:

| Function                                                          | Source                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `getProjectOptions(userId)`                                       | `getProjects` body                                                                                                 |
| `getProjectSummaries(userId)`                                     | `getProjectsWithDetails` body (all aggregates + assembly)                                                          |
| `getProjectById(projectId)`                                       | `getProjectById` + `getProjectForEdit` bodies (one query; `ProjectRecordSchema` output strips the category fields) |
| `createProject(values)`                                           | `createProject` body                                                                                               |
| `updateProject(projectId, values)`                                | `updateProject` body                                                                                               |
| `deleteProject(projectId)`                                        | `deleteProject` body                                                                                               |
| `getProjectPrimaryOwnerId(projectId)`                             | private helper in `project-membership.ts`                                                                          |
| `getProjectMembershipRole(projectId, userId)`                     | private helper `getMembership`                                                                                     |
| `getProjectMembers(projectId)`                                    | `getProjectMembers` body                                                                                           |
| `createProjectMembership(projectId, userId, role)`                | `addProjectAdmin` / `addProjectCollaborator` bodies                                                                |
| `deleteProjectMembership(projectId, userId, role)`                | `removeProjectAdmin` / `removeProjectCollaborator` bodies                                                          |
| `updateProjectMembershipRole(projectId, userId, role)`            | `setProjectMemberRole` body                                                                                        |
| `transferProjectOwnership(projectId, currentOwnerId, newOwnerId)` | `transferProjectPrimaryOwner` transaction                                                                          |

Queries return raw/assembled rows; they perform no permission checks. The `deleteProject` existence check reuses `getProjectPrimaryOwnerId` before `deleteProject`.

### `schemas.ts`

Merges `actions/schemas/project.ts` and `actions/schemas/project-membership.ts` verbatim (no schema edits). May import `CategoryOptionSchema` from `@/actions/schemas/category` (categories domain, later session) and `PROJECT_COLORS` from components, as today.

### `util.ts`

`resolveProjectAccess(projectId, userId): Promise<ProjectAccess>` — renamed from `verifyProjectAccess`, same semantics (owner → membership → deny; super users get no override; missing project → no access). Composes `getProjectPrimaryOwnerId` + `getProjectMembershipRole`. Plain async function, **no `"use server"`** — removes the browser-callable role probe. `lib/safe-action.ts` imports it from `@/actions/projects/util`.

## Import rewiring

| Old                                    | New                         | Scope                                    |
| -------------------------------------- | --------------------------- | ---------------------------------------- |
| `@/actions/projects`                   | unchanged (barrel)          | app pages, stores                        |
| `@/actions/project-membership`         | `@/actions/projects`        | 1 store, 1 test                          |
| `@/actions/schemas/project`            | `@/actions/projects/schema` | stores, components, tests (type imports) |
| `@/actions/schemas/project-membership` | `@/actions/projects/schema` | stores, components, tests                |
| `@/actions/not-safe/project-access`    | `@/actions/projects/util`   | `lib/safe-action.ts` + 8 test files      |

Test mocks also rename `verifyProjectAccess` → `resolveProjectAccess` in the mock factory, `vi.mocked(...)` bindings, and call sites. The 8 files: `actions/__tests__/{backups,safe-action,project-membership,expenses,projects,tasks,task-comments}.test.ts` and `actions/invoices.test.ts` (membership/projects/access tests move into the module first, then update).

## Files deleted

- `actions/projects.ts`
- `actions/project-membership.ts`
- `actions/schemas/project.ts`
- `actions/schemas/project-membership.ts`
- `actions/not-safe/project-access.ts`

## Verification

1. `pnpm verify` — typecheck, eslint `--max-warnings=0`, vitest with coverage floors (60/60/60, 50 branches).
2. `pnpm test:e2e` — Playwright smoke suite on Docker test DB.

## What's left to the builder

- Mechanical extraction of query bodies from action bodies (line-level moves; behavior must be identical).
- Exact ordering of imports/naming details consistent with repo style.
- Deciding whether `getProjectById`'s shared query shape needs a private column subset helper — implementation detail, either is fine.
- Running the verification suite and fixing fallout.

## Pattern for later sessions

Each subsequent domain (clients, tasks, invoices, expenses, products, categories, sales, payments, users, backups, and the remaining `not-safe/*` files) gets the same treatment in its own session: create the folder, extract queries, merge schemas, move helpers to `util.ts`, barrel the actions, rewire imports, move that domain's tests, delete the old flat files, verify. Shared leftovers at the `actions/` root (`error-codes.ts`, `schemas/common.ts`, `schemas/*` of unmigrated domains) stay until their domain migrates.
