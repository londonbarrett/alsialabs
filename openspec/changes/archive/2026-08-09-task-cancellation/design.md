## Context

Tasks live in the `task` table with a `status` text column typed in code as `"todo" | "in_progress" | "in_review" | "blocked" | "done"` (`lib/drizzle/schema.ts`). There is no DB CHECK constraint — status is validated in server actions and controlled in the UI, so adding a value is a pure TypeScript change with no migration.

Status is set in two places: the create/edit dialog (owners) and the inline `TaskStatusSelect` dropdown on the project Tasks table and My Tasks table. Owners can set any status; collaborators and assignees get a restricted set; `done` tasks are read-only for non-owners. Completing a routine-instance task (`done`) spawns the next occurrence via `createNextRoutineTask`, and routine spawning skips if an instance exists with `status <> 'done'`. Project cards show task progress as `done / total`. The "Overdue" badge shows for tasks that are not `done` with a past due date.

Projects already have a `cancelled` status in their own enum (`active | completed | cancelled | archived`), establishing a naming precedent.

## Goals / Non-Goals

**Goals:**
- Add a `cancelled` task status that owners can apply inline, preserving task history and comments
- Non-owners see cancelled tasks as read-only
- Cancelled tasks never show "Overdue" and never inflate the denominator of project progress
- Cancelling a routine-instance task keeps the routine moving (skip to next occurrence)
- Consistent UI: badge color, i18n labels, My Tasks filter

**Non-Goals:**
- No deletion/restore semantics — cancelled is a status, not a soft delete
- No reason/note field for cancellation (can use comments)
- No bulk cancellation or cancellation workflow/approval
- No change to the project status enum (already has `cancelled`)

## Decisions

### 1. Model cancellation as a status value, not a flag

`cancelled` becomes a 6th value in the status union. Alternative: a `cancelled_at` timestamp column. Rejected because every dropdown, filter, badge, and aggregate would need to check both status and the flag; a status value flows through the existing status-driven UI for free. The status column is a plain `text` type, so this is a TS-only change.

### 2. Owners only can set `cancelled`

`ownerStatusSchema` (used by `updateTaskStatus` for owners) gains `cancelled`. `collaboratorStatusSchema` is unchanged. `taskSchema` (create/edit dialog) is unchanged — cancellation is an inline action, not a creation state. `getTaskAllowedStatuses` returns the full owner list for owners; for non-owners, a `cancelled` task returns `null` (read-only badge), mirroring the existing `done` behavior. Server-side, the non-owner guard also blocks changes when `currentTask.status === "cancelled"`.

Owners can reopen a cancelled task by moving it to any active status (consistent with the existing any-to-any owner behavior). Non-owners can never modify cancelled tasks.

### 3. Routine spawning treats `cancelled` as closed and skips ahead

Two coordinated changes:
- `updateTaskStatus` spawns the next instance when status becomes `done` **or** `cancelled`, anchoring at the task's due date: `createNextRoutineTask(routineId, currentTask.dueDate)`
- `createNextRoutineTask`'s open-instance check changes from `ne(status, "done")` to `notInArray(status, ["done", "cancelled"])` so a cancelled instance doesn't stall the routine

Alternative considered: cancelling a routine task halts the routine. Rejected — a cancelled occurrence is analogous to a completed one for scheduling purposes.

### 4. Progress excludes cancelled tasks

`lib/actions/projects.ts` task aggregate changes `total` from `count(*)` to `count(*) filter (where status <> 'cancelled')`. `completed` stays `done`-only. Net effect: progress = done / (total − cancelled). The in-progress count query already uses an explicit `inProgressStatuses` array and is unaffected.

### 5. Overdue badge excludes cancelled

`isTaskOverdue` returns `false` for `status === "cancelled"`, alongside the existing `done` exclusion.

## Risks / Trade-offs

- **Cancelled routine task + reopen → double spawn** → If an owner cancels a routine task (which spawns the next instance) and later reopens the cancelled one to `done`, another instance spawns. The open-instance check prevents more than one new instance at a time, but two total instances can exist. Accepted as an owner-driven edge case; documented in the spawn scenario.
- **Status is TS-only, no DB constraint** → An untyped status could be written outside the app and render a badge without a color (falls back to no class). Pre-existing pattern for all statuses; the `taskStatusColors` map is additive.
- **Raw badge colors vs. semantic tokens** → AGENTS.md prefers semantic tokens, but `taskStatusColors` already uses explicit palette classes. The new `cancelled` entry follows the existing pattern (neutral slate) for consistency.
- **Progress definition changes** → Excluding cancelled from the denominator slightly changes what "total" means. Matches the user's decision; projects with cancelled tasks will show higher percentage.

## Migration Plan

- No DB migration required (text column, TS-typed union).
- Code is additive except the `total` count change and the routine open-instance check, which affect existing data only by excluding `cancelled` (no cancelled tasks exist yet) and changing which statuses are considered open (only matters once `cancelled` is in use).
- Rollback: revert the union change; `cancelled` values would only exist if written in the interim — safe because the column is untyped text.

## Open Questions

None.
