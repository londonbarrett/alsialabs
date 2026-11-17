# Task Visibility Filter, Assignment History, and Assignment Rules

Date: 2026-11-15
Background: fulfills the "future feature" called out in
`docs/superpowers/specs/2026-11-11-multi-assignee-phase2-design.md`
(lines 29, 50, 58) and the original session brief. Visibility semantics
come from that spec's Decided #1 and are **not** being changed.

## Intent

The project task list is a pure work queue: a task leaves the list as
soon as every assignment is done, or its due date expires with nothing
open, and there is no way to see finished work from the project tab —
closed history lives only in My Tasks → Past and the calendar. This
design adds:

1. a **three-way visibility filter** (Both / Unfinished / Finished) in
   the Tasks card, so finished work is viewable and reassignable in
   place,
2. **closed-assignment history** behind a Load More button on an
   expanded repeating task row, paged ten at a time,
3. a **recurrence-aware default assignment fetch** (repeating tasks:
   one row per assignee; non-repeating tasks: full history), and
4. **assignment transition and spawn rules** that keep the
   one-open-assignment-per-assignee invariant unbreakable.

## Goals

- Owner/admin can find finished work in the project tab and bring a
  task back to open work by reassigning someone through the existing
  wizard.
- Anyone with project access can inspect a task's closed-assignment
  history without leaving the project tab.
- `getTasksWithAssignments` transfers one assignment row per assignee
  on repeating tasks; non-repeating tasks transfer their full
  assignment history.
- On repeating tasks, closed assignments can never be reopened
  (terminal→open is rejected) — successor chains can't be corrupted by
  revisiting history. On **non-repeating** tasks managers may reopen
  closed assignments (amendment 2026-11-15); the
  one-open-per-assignee unique index still holds.
- Only the latest assignment in a person's chain can spawn a
  successor.

## Non-goals (explicitly dropped or out of scope)

- **No reopen-by-flip on repeating tasks.** The server rejects
  terminal→open whenever the task has a recurrence, managers included
  (decided 2026-11-15); there the Edit wizard is the only way back to
  open work. On **non-repeating** tasks managers may reopen closed
  assignments (amendment 2026-11-15) — see #4 and #5.
- **No back door for lingering infinite tasks.** A repeating task with
  no due date stays in the active queue forever. The exit for an
  abandoned all-cancelled task is the wizard: reassign someone, then
  unassign-as-done so the task gains a `done` row and the predicate
  hides it.
- **No auto-flip of the filter.** Mutations never change the filter
  setting; the user switches views themselves (decided 2026-11-15).
- No `/tareas/[id]` task-detail route; no fifth project tab.
- No change to `shouldShowTask` (phase-2 Decided #1 stands).
- No URL persistence or store state for the filter — filter state
  stays local UI state (project-management design, lines 137/151).
- No count badges on tabs or the filter.
- No lazy or time-gated spawning: spawn stays a close-time cascade.
  A late close still spawns from the closed row's own date (catch-up).
- My Tasks and the calendar are untouched.

## Decisions

### #1 Entry point: a three-way filter in the Tasks card header

`components/projects/tasks-card.tsx` header currently renders title +
Add Task (lines 146-158). Add a three-option filter beside the title —
**Both / Unfinished / Finished** — bound to a local
`useState<"both" | "unfinished" | "finished">("unfinished")`.

- **Unfinished** (default): current behavior —
  `tasks.filter((t) => shouldShowTask(t, now))` (today's line 50-52).
- **Finished**: the complement — `!shouldShowTask(t, now)`.
- **Both**: every task, ordered per #2.
- Distinct empty states per side (i18n below). Add Task, comments,
  priority, and the action menu stay available in every mode.
- The filter is not in the store, not in the URL; a refresh returns to
  Unfinished. Mutations never touch it (#1's "no auto-flip").

### #2 Row ordering

- **Both**: unfinished group first, then finished group (queue first).
- Within **unfinished**: task `endDate` ascending — overdue first —
  null due dates last.
- Within **finished**: task `endDate` descending, null due dates last.
- **Single-mode filters**: just their group's date ordering.
- Ordering is applied at render in `TasksCard`/`TasksTable`, never in
  the store or the query.

### #3 Visible assignment rows (display rule)

The rule below applies to **repeating tasks**; non-repeating tasks
load their full assignment history (#7) and show every loaded row —
open and closed together — with no history control (#6).

Repeating task:

- if it has **any open assignment** → show only the open rows;
- otherwise (zero open) → show **each assignee's last finished
  (closed) row** — one row per person.

Non-repeating task:

- show **all loaded rows**, open and closed side by side.

Consequences:

- A repeating mixed task (A open, B done) shows only A by default;
  B's closed row arrives through Load More (#6).
- A non-repeating mixed task shows A's open row beside B's closed row
  immediately — no click required.
- A finished repeating task shows one terminal badge row per
  assignee — the session brief's "each assignee's last assignment
  read-only".
- **Supersedes phase-2 Decided #2** ("expanded rows show each
  person's last assignment… supersedes open only") *for repeating
  tasks*: there, closed rows are no longer shown alongside open ones.
  Non-repeating tasks keep phase-2's alongside view, now backed by
  the full-history fetch.
- Implemented at render in `TasksTable` through the
  recurrence-aware `visibleAssignments`. It sits on top of the store
  invariant (#7): with exactly one row per assignee on repeating
  tasks (open-preferred), the zero-open case *is* the per-person
  last-finished set.
- **Rendering split (amendment 2026-11-16)**: for a **repeating**
  task the expanded region's initial block renders only the open
  rows (`shown.filter(isOpenAssignment)` — empty when zero-open) and
  the history panel owns *all* closed display: a zero-open task's
  store rows arrive through the panel's `initialClosed` prop (the
  initial block renders nothing there), a mixed task's closed rows
  through fetch (#6). For a **non-repeating** task the split does not
  apply — the initial block renders every loaded row and the panel
  renders nothing (`recurrence === null` gate).
- **Rows-component split (amendment 2026-11-17)**: the initial block
  is two components — `task-open-assignment-rows.tsx` (status
  select / badge for open rows) and `task-closed-assignment-rows.tsx`
  (badge always, Reopen for managers, order preserved) — plus
  `assignment-columns.ts`'s `assignmentColumnCount(canMutate)` as the
  single home of the `canMutate ? 7 : 6` filler formula (rows + the
  history panel's Load More colSpan).
- **Collapsed-row status summary (amendment 2026-11-17)**: parts
  joined with `" · "` — the open/blocked/review parts while any
  assignment is open, then `projects.tasks.closedCount` whenever
  `task.closedCount > 0`. A zero-open task with closed rows reads
  `N cerradas` instead of the old `common.unassigned`; only a task
  with no assignments at all keeps `common.unassigned`.
  `closedCount` is a **server-side task-level total** —
  `SELECT task_id, count(*) … WHERE status IN ('done','cancelled')
  GROUP BY task_id` over `task_assignment` (leaf
  `getClosedCountsByTaskIds`, added to `getTasksWithAssignments`'s
  `Promise.all` and to `getTaskWithAssignments`) — the TRUE TOTAL
  including rows behind Load More; recurrence-aware store rows
  undercount on repeating tasks, so the cell never derives it from
  loaded rows. Optimistically it moves with `upsertAssignment`'s
  `closedDelta` (open→terminal +1, terminal→open −1, clamped at 0,
  pend only — the commit carries no delta and a discard reverts it),
  `buildOptimisticTask` approximates it from its own rows, and the
  create/update commit re-seeds the server truth.
- Collapsed-row due-date cell already derives from
  open rows only (`tasks-table.tsx`) — unchanged.

### #4 Finished surface: read-only rows, reopen or reassign

- Every assignment on a finished task is terminal, so the existing
  path renders status badges, never selects
  (`task-closed-assignment-rows.tsx`).
- **Reopen (non-repeating tasks only, managers only):** on a
  non-repeating task, each visible closed row gets a Reopen control
  that flips it back to `todo`, restoring the original dates and
  comment. Because the full-history display (#3) shows closed rows
  beside open ones, a reopen can meet an existing open row of the
  same person (removed-then-reassigned) — the unique index converts
  that to `VALIDATION_FAILED` (existing catch,
  `actions/tasks/actions.ts:204-207`); the same guard also covers
  stale data from another tab. Repeating tasks: badges only.
  Placement call (mine): the control appears wherever closed rows are
  visible in the default view — the Finished filter, the unfinished
  "lingering" zero-open state, and mixed non-repeating tasks — not
  only in Finished; the Load More block stays read-only in every
  mode.
- **The wizard is the universal way back to open work** (any task,
  any filter): action menu → `TaskDialog`/`TaskForm`. It seeds
  assignees from open
  assignments (`task-form.tsx:67-82`), so a finished task opens with
  nobody protected; submitting inserts fresh `todo` rows via
  `syncTaskAssignments` (`actions/tasks/queries.ts:616-635`), and the
  task reappears in the unfinished view. No new code path.
- After the reassignment the filter stays where it is — the task
  leaves the Finished list and the user switches views themselves (#1).

**Assignee removed then reassigned (traced):** removal closes A's open
row with no spawn (`syncTaskAssignments`); the task drops to zero open
and lands in Finished (if a `done` row exists) or lingers unfinished
until its due day (all cancelled). Reassigning through the wizard
inserts a fresh `todo` row whose window is always current or future —
`firstAssignmentWindow` anchors at the task's future start or now
(`lib/tasks/assignments.ts:81-84`) — so the new row is the
latest-dated row for that person. Result: the task resurfaces as
unfinished (filter unchanged) — on a non-repeating task the display
rule shows the open row beside the old closed row (full history,
#3/#7), on a repeating task the open row alone shows with the closed
row one Load More away (#6) — and closing the new row passes guard 4
(no later-dated row) so a repeating chain resumes normally. One
accepted edge: if the task's schedule was shortened between removal
and reassignment, the old closed snapshot can be *later*-dated than
the new row, and guard 4 then ends that person's chain on the next
close — a consequence of the decided "only the latest assignment
spawns" rule (rare; recorded under Risks).

### #5 Assignment transition rules (server)

In `updateAssignmentStatus` (`actions/tasks/actions.ts:118-225`):

- **Terminal→open is rejected when the task has a recurrence.**
  `AssignmentStatusRow` already fetches `recurrence`
  (`actions/tasks/queries.ts:180`); on the manager branch
  (`actions/tasks/actions.ts:150-154`), a terminal row of a repeating
  task accepts only `done` or `cancelled` — any open status returns
  `VALIDATION_FAILED` (domain rule, my call — not a permission gap).
  On a **non-repeating** task, managers may set terminal→open (reopen)
  or terminal→terminal (done↔cancelled). Collaborator branches stay
  as-is (`:136-149` — they already can't touch terminal rows, so they
  keep `FORBIDDEN` from there).
- Open rows keep today's behavior: managers may set any
  `ALL_TASK_STATUSES`, collaborators their `COLLABORATOR_TASK_STATUSES`
  on their own row.
- The spawn cascade is unchanged: it runs only when an **open** row
  crosses into terminal (`:162-164`), so terminal→terminal
  (done↔cancelled) never spawns.
- Rewrite the comment at `:156-160`: repeating tasks reject reopen at
  the rule above (no successor can be revisited); non-repeating tasks
  may reopen but never spawn. The unique-violation catch (`:204-207`)
  now guards two races: concurrent closes racing the spawn insert, and
  a stale reopen whose assignee already holds an open row (e.g.,
  removed-then-reassigned in another tab).
- **No new UI for terminal→terminal flips**: terminal rows remain
  badges in every view; the done↔cancelled manager permission is a
  server rule only (my call — the session never asked for a correction
  control, and the existing badge convention is pinned by e2e).

### #6 Load More on the expanded row (closed-assignment history)

Available in every filter mode for **repeating tasks**, inside the
expanded region of `TasksTable`; non-repeating tasks already hold
their full history (#7) and never get the control:

- Default: the visible rows per #3 — and for a **zero-open** task
  the store's terminal rows themselves, handed to the panel through
  its `initialClosed` prop (the initial block renders nothing there,
  per #3's rendering split).
- Below them, a **Load More** button (existing `common.loadMore`) —
  not a switch, no swap. It fetches **on click**, never on expand
  (the panel's mount fetches nothing — expanding a mixed task shows
  open rows only), and appends the task's **closed** assignments
  (statuses `done`/`cancelled` only), **10 rows per page**, in server
  order `createdAt DESC` (newest first). The button renders until a
  fetch returns `hasMore: false`; a wasted click on a task with no
  closed history is accepted.
- **Merged, re-sorted closed region (amendment 2026-11-16)**: what
  the panel renders is the merge of `initialClosed` and every row
  fetched so far — deduped by assignment id and ordered `startDate`
  DESC, nulls last, *at render* (`mergeClosedRows`/`sortClosedRows`
  in `lib/tasks/list.ts`). Server paging stays `createdAt DESC` +
  offset; because the region is re-sorted from the merged set, fetch
  order can never leak into display order. The dedupe seen-set is
  `initialClosed` ∪ already-displayed ∪ the current response — open
  rows are not part of it (the history query returns terminal rows
  only, so they can never collide). The Load More offset still
  tracks **server rows fetched** (each click advances it by the page
  size), not rows displayed.
- **Auto-fetch on terminal-set change (amendment 2026-11-16 — the
  user's "just-closed row needs a Load More click" report)**: while
  the panel is mounted, a change of the terminal-id signature (a
  close's optimistic flip, a spawn's commit) automatically fetches
  the first history page (offset 0) and merges it — no click. A
  spawn's commit drops the just-closed row from the store, so server
  history is its only home and the fetch is what surfaces it. Mount
  still fetches nothing (the approved matrix). Implementation: the
  existing render-phase pagination reset stays; beside it an effect
  keys off the signature, with the mount signature held in a ref so
  only *changes* fetch (ref updated in the effect). A spawn produces
  two signature changes, so fetches are serialized — while one is in
  flight a new change is parked in `pendingRef` and re-runs a fresh
  offset-0 fetch after the in-flight one settles (never a lost final
  fetch). Each fetch captures the signature at start; on resolve, a
  response whose signature no longer matches is **dropped whole**
  (no `setDisplayed`/`setFetchedCount`/`setHasMore` from it). The
  Load More button keeps its exact click path: same fetch, offset =
  rows fetched, `hasMore` gates the button.
- The default rows stay in place; history appends below them.
- Rows in the appended block are read-only badges (assignee, date
  range, status; the assignment `comment` display is the builder's
  call) — no status selects and no Reopen there.
- Server action: `getTaskAssignmentHistory({ projectId, taskId,
  limit: 10, offset })` — `projectAction` (project access enforced
  by the chain), reads `task_assignment_detail` filtered to terminal
  statuses, returns `{ assignments, hasMore }` with a declared
  output schema.
- State is local to `TaskHistoryPanel` (displayed rows, fetched
  count, `hasMore`), never the store: it is a per-row disclosure, not
  list state, and component state survives collapse/expand while the
  table is mounted.
- **Pagination invalidation**: `fetchedCount`/`hasMore` reset to
  offset-0/`true` whenever the task's terminal-row id set changes (a
  spawn or a close inserts history), keyed by a sorted joined
  signature of the terminal ids computed in `tasks-table.tsx`.
  Already-displayed rows are preserved; the next fetch restarts at
  offset 0 and the id-dedupe reconciles the overlap, so no
  duplicates and no gaps.

### #7 Recurrence-aware default fetch and the store shape

- **Store invariant (repeating tasks)**:
  `TaskWithAssignmentsDTO.assignments` holds exactly one row per
  assignee — their open row when one exists, otherwise their most
  recent closed row (open beats closed; then later `startDate` wins;
  null `startDate` sorts oldest — the semantics of
  `isNewerAssignment`, `tasks-table.tsx:50-64`).
- **Non-repeating tasks**: `assignments` holds **every row** — the
  full assignment history — which is why their expanded view needs
  no paging (#3, #6).
- The fetch partitions on `recurrence`:
  `getTasksWithAssignments` splits the project's task ids into
  non-repeating (detail view — full history) and repeating (latest
  view — one row per assignee), guards each side against an empty id
  list, merges, and groups by task; `getTaskWithAssignments` (which
  reloads the store after create/update — `actions.ts:76,108`) picks
  the same view from the task row's `recurrence`. Both leaf reads
  keep their existing column maps (`ASSIGNMENT_VIEW_COLUMNS` for the
  detail view, `LATEST_ASSIGNMENT_COLUMNS` for the latest view).
- **Spawn commit**: when a close spawns a successor, the store ends
  with the open successor for that assignee and **without** the closed
  row (reducer replaces rather than appends). The pinned store test
  ("adds the spawned occurrence ahead of the closed one",
  `stores/project-tasks/project-tasks-store.test.ts:139`) is updated to
  assert the replacement. Spawn only happens on repeating tasks, so
  the slim invariant there is untouched by the full non-repeating
  fetch; repeating history beyond the latest row stays reachable
  through `getTaskAssignmentHistory`.
- With the invariant enforced on repeating tasks,
  `latestAssignmentPerUser` and `isNewerAssignment` in
  `tasks-table.tsx` are redundant and removed; `sortAssignments`
  stays (it also orders optimistic rows).
- Optimistic rows start from one row per assignee
  (`buildOptimisticTask`); the create/update commit replaces them with
  the recurrence-appropriate fetch above.
- Unaffected consumers: My Tasks (`getMyTasks` — already the detail
  view) and the calendar (does not read `getTasks`); the expenses
  page seeds the same recurrence-aware `getTasks`, where the extra
  closed rows are inert.

### #8 Database views and migrations

- **New view `task_assignment_latest`**: one row per
  `(task_id, user_id)` from `task_assignment_detail`, picked by
  `row_number() over (partition by task_id, user_id order by
  (status in ('done','cancelled')) asc, start_date desc nulls last)`
  filtered to `rn = 1` — the SQL form of #7's rule. Columns: whatever
  `toTaskAssignmentDTO` needs (assignment id, task/user ids, status,
  comment, start/end dates, user name/email/image).
- **`task_assignment_detail` gains `created_at`** for #6's ordering.
- Defined in `lib/drizzle/schema.ts` via `pgView`, generated with
  `pnpm db:generate`, applied with `pnpm db:migrate`. Never hand-edit
  `drizzle/`.
- Unit test: view is exported/defined (pattern:
  `lib/drizzle/schema.test.ts`).

### #9 Spawn guards

In `updateAssignmentStatus` (`actions/tasks/actions.ts:172-192`), the
spawn is computed only when **all** hold:

1. the row was open and is crossing into a terminal status (existing),
2. the task has a recurrence (existing),
3. `computeNextOccurrence` yields a date within the task's `endDate`
   — "task already finished or past its due date → no spawn"
   (existing; `taskEndDate` is already passed in),
4. **new**: no other assignment for the same `(taskId, userId)` has a
   later due date (`endDate`) than the closing row's — "only the
   latest assignment can spawn new assignments". Null `endDate` sorts
   oldest (same convention as `startDateValue`, `tasks-table.tsx:50-54`).

Implementation: a new leaf query
`hasLaterDatedAssignment(taskId, userId, endDate)` in
`actions/tasks/queries.ts` (single `SELECT EXISTS`), checked before
building the spawn. The status write itself is unchanged.

Status of guard 4: with repeat-task reopen eliminated (#5), the
revisit-an-old-row scenario that motivated it is unreachable, and on
normal chains the open row is always the latest-dated row (spawn
successors and wizard inserts both land at the current/future
schedule). Non-repeating reopen can't trigger spawn at all (no
recurrence). It is kept as a cheap invariant defense (one query per
close, never fires in normal operation).

Consequences (decided):

- A late close still spawns from the closed row's own date — a
  backdated successor that catches up one occurrence per close.
  Accepted.
- Cancelled closes still spawn for repeating tasks (only the wizard's
  `syncTaskAssignments` and non-repeating tasks never spawn,
  unchanged).

### #10 Predicate runs over the recurrence-aware rows (accepted edge change)

`shouldShowTask` is unchanged, but its input is now #7's
recurrence-aware rows. On repeating tasks one edge changes: a user
whose history contains `done` but whose **latest** row is `cancelled`
no longer hides the task — it lingers until its due day instead of
vanishing immediately. Accepted as more correct (that person's
current state is cancelled). Non-repeating tasks read their full
history, so a `done` row anywhere still hides them — the pre-feature
behavior.

### #11 Translations

`messages/en.json` and `messages/es.json` stay structurally identical.
New keys:

| Key | en | es |
| --- | --- | --- |
| `projects.tasks.both` | Both | Ambas |
| `projects.tasks.unfinished` | Unfinished | Sin finalizar |
| `projects.tasks.finished` | Finished | Finalizadas |
| `projects.tasks.noFinished` | No finished tasks yet | Aún no hay tareas finalizadas |
| `projects.tasks.reopen` | Reopen | Reabrir |
| `projects.tasks.closedCount` | `{count, plural, one {# closed} other {# closed}}` | `{count, plural, one {# cerrada} other {# cerradas}}` |
| `common.loadMore` | Load more | Cargar más |

Reuse as-is: `errors.VALIDATION_FAILED`, `common.unassigned`,
`common.tasks`, `projects.tasks.assignmentsToggle` (the expand
chevron), `projects.tasks.noTasks`. Dynamic key-maps are never renamed.

## Testing

- **Unit (vitest, beside the file):**
  - Transition rules in `actions/tasks/tasks.test.ts`: repeating
    task + manager terminal→open rejected (`VALIDATION_FAILED`);
    non-repeating + manager terminal→open allowed (row reopens, no
    spawn); manager terminal→terminal allowed on both kinds and spawns
    nothing; reopen colliding with an existing open row → unique
    violation mapped to `VALIDATION_FAILED`; open-row statuses
    unchanged; collaborator branches unchanged. Audit existing tests
    for any terminal→open expectation and update it.
  - Spawn guards: later-dated row exists → no spawn; reopen-motivated
    cases are gone — replaced by an artificial later-dated-row fixture;
    task past due → no spawn (existing cases stay).
  - `getTaskAssignmentHistory`: terminal filter, ordering, offset
    paging/`hasMore`, mocked via `vitest-drizzle-mock` on the detail
    view.
  - `getTasksWithAssignments` / `getTaskWithAssignments` mock the
    latest view and assert one-row-per-assignee grouping, plus view
    pins per recurrence: a non-repeating task's rows are read from the
    detail view (recorded SQL), a repeating task's from the latest
    view. `lib/tasks/list.test.ts` covers the recurrence-aware
    `visibleAssignments` (non-repeating → identity, repeating →
    open-only when any row is open, else every row).
  - Store: spawn commit replaces the closed row with the open
    successor (updated pinned test, #7).
  - `lib/tasks/filter.test.ts` unchanged (predicate untouched); add
    the slim-input edge case from #10.
- **E2E (Playwright, through the pages, `signInAs` fixtures):**
  - New `e2e/task-filter.spec.ts`: complete a task → row leaves
    Unfinished → switch filter to Finished → row present with
    read-only badges and no status selects → Edit-wizard reassign →
    filter is unchanged (no auto-flip) and the task is gone from
    Finished; switch to Unfinished → row carries an open control.
    Filter ordering: Both shows unfinished before finished, date
    ordering within each group.
  - Load More matrix (repeating): a mixed repeating task (one open,
    eleven closed) expands to the single open row plus Load More;
    the first click appends ten closed rows newest-first below the
    open row, the second appends the eleventh and hides the button.
    A finished repeating task shows its last-closed row per assignee
    and, on Load More, never duplicates it (dedupe + `hasMore:
    false` hides the button).
  - Non-repeating: a mixed task (one open, one closed) shows both
    rows immediately with no Load More button — in
    `e2e/multi-assignee.spec.ts` the closed row flips from "behind
    the history control" to "visible by default".
  - Reopen paths: non-repeating finished task shows a Reopen control
    (manager) → click → task leaves Finished (filter unchanged) →
    Unfinished shows it with an open status control again; repeating
    finished task shows badges only (no Reopen control); collaborator
    sees no Reopen anywhere.
  - Removed then reassigned: unassign a member (mark cancelled) →
    task zero-open behavior as decided → reassign via wizard → task
    back in Unfinished with the fresh open row beside the old closed
    row, no Load More (non-repeating full history).
  - Existing `e2e/multi-assignee.spec.ts` pins (done → disappears;
    all-cancelled stays visible with the closed-count status text
    (`1 cerrada`) in place of the old "Sin asignar"; terminal rows
    read-only) must keep passing.
  - `closedCount`: reducer unit tests for `upsertAssignment`'s
    `closedDelta` (+1 / −1 / clamp at 0 / absent default), the
    `getTasks`/`createTask`/`updateTask` count-query mocks, and the
    paging e2e's status-cell pin (`1 abierta · 11 cerradas` with ten
    rows still behind Load More).
- **Gates:** `pnpm verify` (typecheck + eslint + vitest coverage) and
  `pnpm test:e2e`.

## Risks and edge cases

- **Reload paths must stay recurrence-aware.**
  `createTask`/`updateTask` reload through `getTaskWithAssignments`;
  a repeating task that receives full history (or a non-repeating
  one that stays slim) breaks its display rule silently — covered by
  #7's view split and its tests.
- **Display-rule visibility change.** Closed rows disappear from
  *repeating* mixed tasks' expanded regions (superseding phase-2
  Decided #2 there); anyone relying on that glance must use Load
  More. Non-repeating mixed tasks keep their closed rows visible.
  The spec supersedence is recorded above.
- **Guard 4 is read-then-write.** Two concurrent closes can race; the
  partial unique index is the backstop, and the worst case is a
  rejected spawn, never a duplicate open row.
- **Schedule shrink can end a chain.** If a repeating task's schedule
  is shortened between an assignee's removal and reassignment, their
  old closed snapshot can be later-dated than the fresh open row, so
  guard 4 stops the spawn when that row closes (chain ends for that
  person). Rare and accepted under "only the latest assignment
  spawns"; the wizard reassign starts a new chain afterward if needed.
- **Stale reopen vs. reassignment.** Reopening a closed row for
  someone who already holds an open row (both tabs) trips
  `task_assignment_open_unique` → `VALIDATION_FAILED` toast — handled
  by the existing catch, surfaced as an error, never a crash.
- **Offset pagination** shifts if another row closes mid-scroll —
  accepted at this scale (10 per page).
- **Window-function view** must be expressible in Drizzle's `pgView`
  (subquery + outer filter). If drizzle-kit's generated SQL is
  awkward, an alternative is selecting the window inline in the two
  assignment queries; the view is preferred for reuse and testability.
- **Finished-task due cell**: with zero open rows the due cell already
  falls back to `task.endDate` (`tasks-table.tsx:237-247`) — finished
  rows show the task due date, not the last occurrence's.

## Left to the builder

Small choices that don't change what is built: exact filter control
styling (segmented buttons vs. select) within the header; whether
history rows show the assignment comment; Load More disabled/spinner
state while fetching; empty-state copy for the Both mode when both
sides are empty; whether the finished table hides the open-count
summary cell (it already renders `common.unassigned` when nothing is
open).
