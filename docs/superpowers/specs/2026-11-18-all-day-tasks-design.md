# All-Day Tasks and Due-Date-Only One-Off Tasks

Date: 2026-11-18
Background: amends `docs/superpowers/specs/2026-10-30-multi-assignee-tasks-design.md`
(task form wizard, window semantics, occurrence spawn) and refines the overdue
rule behind the due-date cell in `docs/superpowers/specs/2026-11-11-multi-assignee-phase2-design.md`.
Decided with the user in session; implemented and verified the same day.

## Intent

Two scheduling rules the dialog previously could not express:

1. **A one-off task lives on a single day.** The schedule step asks only for
   a due date — the start-date field is gone — and the form derives
   `startDate` := due date, so a multi-day one-off cannot be created. A legacy
   row that spanned days normalizes to its due date the next time it is saved.
2. **All day is the default; times are opt-in.** Both branches of the schedule
   step open with an "All day" switch checked; the time inputs — a one-off's
   start/end window, a repeating task's occurrence times — are hidden until
   the switch comes off. Saving all-day travels as empty time strings:
   midnight timestamps for one-offs, null `startTime`/`endTime` columns for
   repeating tasks.

Everything downstream treats that state as first class: an all-day repeating
chain spawns at midnight instead of stalling, the first assignment anchors on
the calendar day, due cells drop the time-of-day, overdue flips only after the
day ends, and calendar events get the exclusive midnight end the week/day lane
requires.

## Goals

- A one-off's field set cannot express multi-day: a due date, plus optional
  times behind the switch.
- New and edit open all-day unless the stored data carries times; the payload
  shape (`startDate`, `endDate`, `startTime`, `endTime`) is unchanged — empty
  strings remain the all-day encoding.
- All-day never demands times; with the switch **off**, both time inputs are
  required in **both** branches — "Time is required" (`common.timeRequired`)
  on the empty field, never the misleading "end date must be after start
  date". The server still accepts a repeating task with no occurrence time:
  all-day is a server-valid state and the requirement is the form's gate.
- An all-day repeating chain behaves exactly like a timed one — spawn, first
  assignment, history — with no null-dated assignment rows and no silent end
  of chain.
- All-day tasks read as all-day everywhere: due cells, overdue badges,
  calendar week/day lanes, month "past" styling.

## Non-goals

- **No DB flag and no migration.** All-day is inferred: midnight timestamps
  (the calendar's existing heuristic at event build) and null `startTime`.
  The user considered an `is_all_day` column and accepted inference once shown
  that both empty fields already encode it.
- The dialog contract and stored columns are untouched; only the UI and the
  rules around them change.
- The repeat switch, recurrence options, the optional "until" end date, the
  visibility predicate, and the one-open-assignment-per-assignee invariant
  are unchanged.
- A one-off's start date disappears from the dialog only — the column and the
  server's same-day backstop stay, so direct API writes still cannot create a
  multi-day one-off.

## Decisions

### #1 Schedule-step layout

- One-off branch: **Due Date** field (date only) → **All day** switch → when
  the switch is off, **Start time** / **End time** inputs, each with its own
  visible label (`common.startTime`, `common.endTime`).
- Repeating branch: **Start date** → **Due Date** (until) → **All day**
  switch → when off, the **Perform at** occurrence window.
- The switch sits directly above the inputs it reveals in both branches.
  Label reuses `calendar.allDay`. It is on by default for a new task; editing
  derives it from stored times (repeating: `!task.startTime`; one-off: both
  timestamps at midnight via `isAllDayDate`). Toggling clears pending errors.
- Each one-off time input carries its own visible label (`common.startTime`,
  `common.endTime`): the first cut split the one-off times out of the Due Date
  field and left them unlabeled; review caught it. In the repeating pair the
  start input keeps the shared Perform-at label and the end input is named
  with `aria-label` (`common.endTime`), which it had always lacked.

### #2 Payload and validation

- `allDay` → all four time strings submit as `""`: the one-off start becomes
  `combineDateTime(dueDate, "")` (midnight) and both timestamps match; the
  repeating anchor and occurrence columns become midnight / null.
- Client (`lib/tasks/form-validation.ts`): a window with exactly one of
  `startTime`/`endTime` set pushes `START_TIME_REQUIRED`/`END_TIME_REQUIRED`
  and **skips the ordering check** — a half-entered window reports "Time is
  required" (`common.timeRequired`) on the empty field instead of blaming the
  date. Both blank passes: that is all-day.
- Client (repeating): the old missing-occurrence-time error — which always
  showed the wrong message ("start date cannot be in the past") — is replaced
  by the switch-gated "Time is required" check below.
- **With the switch off, both time inputs are required — in either branch.**
  The submit gate in `task-form.tsx` reports `common.timeRequired` on each
  empty field: a one-off's start and end window, a repeating task's occurrence
  start and end. With the switch on the times travel as `""` and nothing is
  demanded. The half-window rule above keeps any partially entered window
  from being blamed on the date, and a lone `endTime` without a `startTime`
  can no longer be written through the form.
- Server (`actions/tasks/schemas.ts`): `START_TIME_REQUIRED` removed from
  `refineTaskWindow`; the one-off same-day and ordering checks stay as the
  backstop for non-form writes. Repeating times are optional end to end.

### #3 First occurrence and spawn

- `computeScheduledFor` gained `options.inclusive` (default strict). Strict
  comparison is what keeps completion spawning from ever re-selecting the
  occurrence that just finished — it stays strict for `computeNextOccurrence`.
- `firstAssignmentWindow` passes `inclusive: true`. For an all-day task the
  anchor is a calendar day at midnight: without inclusivity the strict
  "after" comparison skipped the anchor day itself (or, compared against
  `now`, pushed every slot to tomorrow). All-day anchors day-precision —
  `max(anchor, today)` at midnight, never before today; the timed path
  (`anchor > now ? anchor : now`, strict) is unchanged, preserving its
  "never anchors in the past" rule.
- `computeNextOccurrence` and `firstAssignmentWindow` schedule with
  `time: task.startTime ?? "00:00"`. This repairs two silent failures of a
  null-time row: the repeat chain ended with no successor, and
  `firstAssignmentWindow` returned `{startDate: null, endDate: null}`, which
  wrote null-dated assignments (invisible in the calendar, sorting last).

### #4 Display and overdue

- `formatDueDate` (extracted from the DueDate cell into `lib/util/tasks.ts`):
  a midnight timestamp renders month + day only — no more "12:00 AM".
- `isTaskOverdue`: a midnight deadline becomes overdue only after
  `endOfDay(...)` of its day. This aligns the badge with `shouldShowTask`,
  which already kept tasks visible through their whole due day; previously an
  all-day task was red from 00:00 while still listed as current.
- `buildCalendarEvents`: an all-day event whose window is zero-duration (or
  whose `endDate` is null) gets `end` = next local midnight — the exclusive
  end the calendar spec documents for its all-day lane. Midnight-to-midnight
  task events previously failed the lane's strict `end > dayStart` filter and
  vanished from week/day views, and month "past" styling dimmed them from
  their first minute. Timed windows that merely start at midnight are left
  alone. `grid-view` itself needed no change: the fix is at the source.

### #5 Dialog height cap

- `DialogContent` now carries `max-h-[calc(100vh-2rem)] overflow-y-auto`. The
  added switch pushed the repeating dialog past a 720px viewport with no
  scroll anywhere, leaving the submit button off-screen and unreachable — the
  e2e hang that uncovered it. Dialogs that fit render exactly as before.

### #6 i18n

- Added `common.timeRequired` ("Time is required" / "La hora es obligatoria"),
  `common.startTime` ("Start time" / "Hora de inicio"), `common.endTime`
  ("End time" / "Hora de fin"). Switch label reuses the existing
  `calendar.allDay` ("All-day" / "Todo el día"). `projects.routines.startNotPast`
  is now unreferenced but left in place.

## Testing

- Unit: `actions/tasks/schemas.test.ts` — a repeating task without a
  `startTime` is valid; `lib/tasks/form-validation.test.ts` — a half-window
  blames the empty time (and not `END_BEFORE_START`), blank times pass;
  `lib/tasks/recurrence.test.ts` — null `startTime` spawns at midnight;
  `lib/tasks/assignments.test.ts` — an all-day task's first occurrence is the
  anchor day itself (and today when there is no future anchor), while the
  timed "never anchors in the past" case is unchanged; new
  `lib/util/tasks.test.ts` — overdue and label rules;
  `lib/calendar/util/events.test.ts` — the exclusive end, plus a timed window
  starting at midnight staying as-is.
- E2E: the wizard specs assert the default (switch checked, time inputs
  absent) on both branches, that **both times are required off all-day in both
  branches** (a blank-window submit fails on the fields themselves), the
  end-before-start path, and a full timed-repeating flow (switch off → fill
  both occurrence times → create → re-edit shows All day unchecked). Both
  switches are located by accessible name (`Repetir esta tarea` /
  `Todo el día`), never `getByRole("switch")` bare.
- `pnpm verify` (typecheck + lint + unit with coverage) and `pnpm test:e2e`
  green.

## Risks and edge cases

- **Inference edges:** a timed window that starts at exactly 00:00 reads as
  all-day (the calendar already used the same heuristic), and a one-off whose
  two timestamps are both midnight re-opens with the switch on. Accepted with
  the no-flag decision.
- **Switch off blocks save until both times are set:** blank times are only
  savable with the switch on (all-day). A half-entered one-off window reports
  the empty field; the date is never blamed.
- **Orphaned occurrence end time:** a repeating row with null `startTime` but
  a set `endTime` — reachable only through the API or legacy data now that
  the form demands both times when off — keeps that end time until its next
  save: All-day derives from `startTime`, so the save clears it. Its
  occurrences run midnight to that time meanwhile.
- Editing an all-day task with the switch off shows empty time inputs rather
  than prefilled "00:00" — intentional, so the user states real times.

## Left to the builder

- None — implemented and verified in this session (527 unit tests, 25 e2e).
  The spec documents shipped behavior per repo convention.
