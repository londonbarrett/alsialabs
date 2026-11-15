# Multi-assignee tasks — Phase 2 (UI) — Design

## Why this exists

Phase 1 (see `2026-10-30-multi-assignee-tasks-design.md`) rebuilt the data model so a task can carry many assignments: `task_assignment` is one row per person, every action accepts `assigneeIds: string[]`, and the calendar and My Tasks already render multiple people. But the two surfaces where a manager coordinates work still behave as if a task had one assignee: the task form collects a single `assigneeId`, and the project task table renders only `assignments[0]` with an inline status dropdown bound to that first row. Extra assignees are invisible, unmanageable, and easy to create by accident.

This session ships Phase 2: the multi-assignee picker, the multi-assignee task row built around **open assignments**, and the manager actions (status changes, unassign-with-disposition) that follow from that.

## Scope

In scope:

1. Multi-select assignee picker in the task form (create and edit), for repeating and non-repeating tasks.
2. Task table rework: avatar stack, open-assignment counts, expandable rows showing each assignee's last assignment with per-person status controls.
3. Removal of the inline status dropdown from the collapsed row.
4. A reusable multi-action confirmation dialog (modeled on `components/common/destructive-dialog.tsx`) used when an edit would close someone's open assignment.
5. Closing instead of deleting open assignments on unassign (history preservation; no future spawns for that user).
6. Project-member removal gains a destructive confirm that closes the member's open assignments as `cancelled`.
7. i18n (en + es), unit tests, e2e tests.

Out of scope (unchanged):

- **No schema changes.** `task`, `task_assignment`, migrations: untouched. No `task_instance` table — grouping is derived in memory from assignment date windows where needed (calendar already does this).
- **No action signature changes** beyond an optional input field on `UpdateTaskSchema` (see "Unassign flow"). `createTask` already takes `assigneeIds`; `syncTaskAssignments` already diffs open rows.
- **Repeating-task auto-spawn** stays exactly as it is: each person's chain advances when they mark their open occurrence `done`/`cancelled`. No manager-approval step, no batch spawn.
- **Calendar** — already groups multiple assignees per event; untouched.
- **My Tasks** — already per-person (one row per caller assignment, active/past split); untouched. It and the calendar are where closed history remains visible.
- **Assignment notes / comment threads in rows** — deferred to a later session; no comment inputs ship in the table.
- **A way to view or reopen finished tasks from the project tab** — deferred to a future feature (decided: finished tasks simply leave the list).
- Notifications of any kind.
- The list filter switch discussed earlier — **cancelled**; replaced by "open work only" (see below).

## Goals

- A manager can assign any number of project members to a task, repeating or not, in the existing two-step wizard.
- A manager sees at a glance who is on a task and how much of it is still outstanding, and can act per person.
- Status is edited only in the expanded per-assignee rows — one control per person, never a task-level status.
- The project task list is a work queue: tasks with open assignments always show; abandoned work (nothing open, nothing done) lingers as "Unassigned" only until its due date expires.
- Unassigning someone never destroys history and never silently deletes: an open assignment is closed as `done` or `cancelled` at the user's explicit choice, and no further occurrences spawn for that user.
- Removing a project member is an explicit destructive action that closes their open assignments.
- Zero-assignee tasks remain first-class: they show "Unassigned", carry no counts, and stay in the list while their due date is valid (open work nobody has picked up).

## Non-goals

- Notifications ("you were assigned", "day closed").
- Drag-and-drop reordering of assignees or rows.
- Per-assignee due-date editing from the table (edit stays in the wizard; dates remain assignment snapshots).
- Any change to how occurrences spawn.
- A task-level status column or "primary assignee" (explicit Phase 1 anti-goal).
- Viewing finished tasks in the project tab (future feature).
- Assignment-note/comment-thread UI (later session).

## Decided with the user

1. **The project task list shows open work, and lingers abandoned work until it expires.** Two-tier predicate, decided with the user:
   - **≥1 open assignment** (`status NOT IN ('done','cancelled')`) → **always shown**, even if the due date has passed and even if some assignments are already `done`. Open work is the point of the list.
   - **No open assignments** → shown only while **no assignment is `done`** *and* the **task's due date is still valid**. Such a task renders as "Unassigned" (its closed `cancelled` rows are history, not shown). This is how an abandoned task (everyone unassigned/cancelled) lingers as reassignable work until its window expires.
   - Otherwise (some assignment is `done`, or the due date has passed with nothing open) → **hidden** until the future "finished tasks" feature.
   - Due date semantics (my call): always `task.endDate` — for non-repeating tasks it's the work window's end; for repeating tasks it's the schedule's optional end ("repeat until this date", same column). A repeating task with `endDate = null` **never expires**, so an abandoned infinite repeating task lingers until reassigned or the schedule ends. There is **no filter switch**.
2. **Expanded rows show each assignee's LAST assignment** (updated 2026-11-11 with the user — supersedes the earlier "open assignments only" rule): one row per person with ≥1 assignment — their open row when they have one, else their most recent closed row (latest `startDate`; `cancelled` rows included — the user explicitly wants removed/cancelled people kept visible). `done`/`cancelled` rows render read-only badges, never a status select. Full occurrence history still never renders (bounded to one row per person); history lives on in My Tasks → Past and the calendar.
3. **Collapsed-row status cell = counts, no fraction, no bar.** "N open" is the base; add "N blocked" and "N in review" only when non-zero. My call: blocked and in-review rows are *included* in the open count and called out as subsets — e.g. `3 open · 1 blocked · 1 in review`. Unassigned tasks show "Unassigned" instead of counts.
4. **Status editing lives only in expanded rows**, for single- and multi-assignee tasks alike. The collapsed row loses its `TaskStatusSelect`.
5. **Unassign from a task** (form only — removing people from the project stays in the People tab): a three-option dialog — **Mark as done**, **Mark as cancelled**, **Cancel** (aborts the save). Confirming closes the open assignment and ends that user's spawn chain; history is kept.
6. **People-tab member removal gains a destructive confirmation** (none exists today — removal is currently one-click). On confirm, the member's open assignments are closed as `cancelled`. Same treatment when removing an admin from membership (same code path). My call: apply to any membership removal.
7. **The confirmation dialog is a reusable common component**, in the spirit of `components/common/destructive-dialog.tsx`: same controlled `open`/`onCancel` shape, but its footer accepts several action buttons plus cancel — not just one confirm.
8. **No comment inputs in table rows.**
9. **Visual design is iterative**: avatar stack, counts cell, and expansion interaction get polished in a review pass at the end until the user is happy. Functional behavior above is fixed; presentation is not.
10. **Bugs found along the way get fixed in-session**; each task ends with `pnpm verify` and `pnpm test:e2e` green.

## Component and behavior design

### 1. Assignee picker (form)

- `components/projects/task-assignee-select.tsx` becomes a multi-select over `ProjectMemberRowDTO[]` (same source: `useProjectContextState().members`, which includes the owner).
- `task-form.tsx` state changes from `assigneeId: string` to `assigneeIds: string[]`, seeded from the task's **open** assignments only. Closed history rows are not pre-selected (re-adding a person later starts a fresh row — Phase 1 rule 7). The picker lists only current project members; if an open assignment belongs to a user no longer on the project, the People-tab removal path should have closed it already (see §6) — the form does not need to render non-members.
- Submit passes `assigneeIds` straight through — the payload shape does not change.
- Same component and step for repeating and non-repeating tasks; the schedule step is untouched.
- Interaction detail (popover with checkboxes vs. chips vs. combobox) is a builder call, to be polished in the visual pass.

### 2. Task table — collapsed row

`components/projects/tasks-table.tsx`:

- **Source rows**: the store already holds full DTOs; the table filters client-side with the two-tier predicate from Decided #1 (open work → always; no open work → only while no `done` row exists and the due date is valid). Pure, unit-testable helper in e.g. `lib/tasks/filter.ts` (`shouldShowTask(task, now)`), taking `now` (or a date) so expiry is testable without fake timers.
- **Assignee cell**: avatar stack — one avatar per assignee (distinct users with ≥1 assignment, any status — the same set the expansion shows; overflow `+N` past a small threshold). Zero assignments: `common.unassigned`.
- **Status cell**: counts as in Decided #3 — `N open` (+ `N blocked` / `N in review` when non-zero), or "Unassigned". Read-only; no control.
- **Due date cell**: the earliest **open** assignment's `endDate`; if none is open (lingering unassigned task), fall back to the task's own due date (used by the show-predicate). Overdue styling via existing `isTaskOverdue` on the same assignment.
- **Priority, comments button, actions menu, recurring badge, description**: unchanged.
- Row expansion: a chevron/toggle on the row (builder's choice of affordance). Double-click still opens comments. Expansion state is local to the table component (a `Set<string>` of expanded task ids; no store field).

### 3. Task table — expanded per-assignee rows

- One sub-row per assignee's LAST assignment (Decided #2): avatar, name, email, occurrence window (`startDate`–`endDate`), and either a `TaskStatusSelect` with `ALL_TASK_STATUSES` (open rows only; only owner/admin reach this route) or a read-only status badge for `done`/`cancelled` rows.
- Status changes reuse the existing `onStatusChange(taskId, assignmentId, status)` path → `updateAssignmentStatus` → store `upsertAssignment`; the repeat cascade and its toast already work per assignment and need no change. When a completed occurrence spawns its successor, the person's latest row becomes the new open row — no special handling.
- No comment/note input in the row.
- Row set: for each distinct user in `task.assignments`, pick their open row if any, else the closed row with the latest `startDate`; order the per-user rows with the existing `sortAssignments`. Layout/indentation is polish-pass territory.

### 4. Unassign flow (close, don't delete)

Today `syncTaskAssignments` **deletes** open rows for removed users. Target behavior:

- `UpdateTaskSchema` gains an optional per-user field, `unassignAs?: Record<string, "done" | "cancelled">` (one disposition per removed user — different people can close differently).
- `queries.syncTaskAssignments(taskId, assigneeIds, taskRow, unassignAs?)`: for a removed user with an open row — **UPDATE that row's status** to `unassignAs[userId]` when present, else `cancelled` (dates, comment, id untouched); never DELETE — the delete path disappears entirely.
- **Closing via sync never spawns a next occurrence**, even on a repeating task: the spawn cascade lives only in `updateAssignmentStatus`. Unassigning ends this person's chain; spawning would contradict the removal. Tests must pin this down.
- **UI sequence (updated 2026-11-11 with the user: dialog fires at chip removal, not at save)**: in the edit form, clicking a chip's remove button — or unchecking a member who holds an open assignment on the server ("protected") — opens the multi-action confirm dialog immediately: "Mark as done" / "Mark as cancelled" remove the chip and record that user's disposition in the form; "Cancel" leaves the chip in place. Removing a member added earlier in the same unsaved session (no server row yet) needs no dialog. On save, the recorded dispositions travel as `unassignAs`; entries for users who were re-added before saving are ignored by the server (they are not in the removal diff). The save itself never opens a dialog.
- Re-adding a person later starts a fresh `todo` row — already how `syncTaskAssignments` inserts; unchanged.

### 5. Reusable multi-action dialog

New `components/common/action-confirm-dialog.tsx` (name negotiable), sibling of `destructive-dialog.tsx`:

```
interface ConfirmAction {
  label: string
  onClick: () => void
  variant?: ButtonVariant   // default "outline"; destructive available
}
interface ActionConfirmDialogProps {
  open: boolean
  title: string
  message: string
  actions: ConfirmAction[]  // rendered left-to-right before cancel
  onCancel: () => void
  loading?: boolean         // mirrors DestructiveDialog's prop; same TODO applies
}
```

- Controlled exactly like `DestructiveDialog`: `onOpenChange(false)` → `onCancel`.
- Cancel button always present (`common.cancel`).
- The unassign flow uses it with two actions (done / cancelled); it stays generic — no assignee-specific logic inside.
- Whether `DestructiveDialog` is refactored onto it is a builder call; not required.

### 6. Member removal closes open assignments

- The People tab's remove-member (and remove-admin-from-membership) action, after its existing destructive confirm succeeds, also closes that user's open `task_assignment` rows as `cancelled` in the same operation — ideally one transaction in `queries`.
- Closed rows keep their dates, comments, ids: history preserved. Re-adding the member later starts fresh rows on future saves.
- This removes the stranded-open-assignment state the form would otherwise encounter.
- Scope note: this touches the project-membership actions/queries, not just the task module — keep it minimal (close open rows; nothing else).

### 7. Stores

- `stores/project-tasks/`: no structural change. `updateTask` already receives `assigneeIds` and the commit swaps the whole row; optimistic construction in `use-project-tasks-actions.ts` already maps multiple ids into assignment objects. Add: pass `unassignAs` through to `updateTask` when the form supplies it. Status flow (`upsertAssignment`) is already per-assignment.
- List filtering (the two-tier show-predicate) and expansion state do **not** enter the store — the table filters the DTOs it is given.
- `stores/my-tasks/`, `stores/project-context/`: untouched except that member removal may reseed context (existing member-removal flow already handles this).

## i18n

`messages/en.json` and `es.json` stay structurally identical. Expected new keys (names approximate; reuse `common.*` where the term already exists):

- Status counts: `projects.tasks.openCount` (with count formatting), `blockedCount`, `reviewCount` — or a single composite label; builder's choice.
- Confirm dialog: `projects.tasks.unassign.title`, `.message` (must say history is kept and no more occurrences will spawn), `.markDone`, `.markCancelled`.
- Member-removal dialog copy if not already present (it should be — destructive dialog already exists for that flow).
- Reuse: `common.assignee`, `common.unassigned`, `common.status`, `common.cancel`, `projects.tasks.status.*`, `projects.tasks.recurring`.
- Check for existing keys before adding; the Phase 1 key sweep may already have `projects.tasks.assignments`.

## Testing

Unit (vitest, beside the code):

- `shouldShowTask` predicate (with injected `now`): ≥1 open row → shown regardless of due date/done rows; zero open + no `done` row + `task.endDate` valid → shown; zero open + `done` row → hidden; zero open + `task.endDate` passed → hidden; `task.endDate = null` → never expires (never-assigned + null end → always shown; repeating without end → always shown).
- Status-count helper: open/blocked/in-review counts with subsets included in open; unassigned → no counts.
- `syncTaskAssignments` with `unassignAs`: closes each removed user's open row with their own disposition (status updated, row kept, id/dates/comment untouched); **no spawn on a repeating task**; **absent map → closes as `cancelled` (never deletes)**; kept users' rows untouched; mixed dispositions in one save each land on the right row.
- `UpdateTaskSchema`: optional per-user disposition record validation.
- Membership removal: closes the removed user's open assignments as `cancelled`, keeps closed history (extend `actions/projects/project-membership.test.ts`).
- Form: seeds open assignments only; submits multiple ids.
- Store: `updateTask` with `unassignAs` passes through; existing optimistic tests keep passing.

E2E (Playwright, through the pages):

- Owner creates a task with **two** assignees → both visible (avatar stack), status cell reads `2 open`.
- Expand the row → change one person's status to `done` → their row stays visible as a read-only badge (no combobox), counts read `1 open`; the other person's control unaffected.
- A task whose assignments all become `done` **disappears from the list**; one whose assignments are all `cancelled` (nothing done, due date valid) **stays as "Unassigned"**; once that lingering task's due date passes it disappears too.
- Unassigned task shows "Unassigned", no counts, stays in the list (until expiry if it has a due date).
- Edit the task, unassign the person with the open assignment → three-option dialog → choose cancelled → save succeeds; re-open edit → they are not pre-selected; their row is gone from the table (closed, not deleted — assert via data/My Tasks if practical), and the task remains visible as "Unassigned" while its due date is valid.
- Removing a member from the People tab (destructive confirm) → their open assignments on tasks are closed; a task left with an all-cancelled/never-done assignment set stays as "Unassigned" until its due date expires, while one with a `done` assignment leaves the list.
- Repeating-task spawn spec (`e2e/repeating-tasks.spec.ts`) must stay green — auto-spawn is unchanged; after completing, the person's latest row is the newly spawned open one (the closed occurrence is no longer their latest).
- Existing specs updated where they assume `assignments[0]` rendering (`e2e/task-assignments.spec.ts` asserts name+email in the table — must match the new cell) and where the inline status select disappears.

## Verification

Each increment: `pnpm verify` (typecheck + lint + coverage floor) and `pnpm test:e2e`. The visual polish pass comes after functionality is green, then a final full verification. Commits only on explicit user approval; nothing pushed without a separate go-ahead.

## What is left to the builder

- Exact multi-select interaction for the picker (popover checklist, chip input, combobox) and its keyboard/empty states.
- Avatar stack rendering details (image fallback to initials, overflow threshold, tooltip contents).
- Exact look of the counts cell and the collapsed status presentation.
- Expansion affordance (chevron vs. clickable cell) and sub-row layout/indentation.
- Whether `DestructiveDialog` is refactored onto the new `ActionConfirmDialog`.
- Where the show-predicate lives (`tasks-card.tsx` or `tasks-table.tsx`).
- Translation copy final wording (en/es).
- Whether membership removal and task unassign share any helper for "close open rows as cancelled" (likely a small query helper reused by both).
- Any incidental bugs discovered during implementation — fix and cover with tests in-session.
