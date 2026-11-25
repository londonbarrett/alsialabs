# Project time zones — design

Date: 2026-11-23

## Why

Creating a new assignment can fail silently: a date calculation returns no slot
and the assignment is inserted with null dates. The underlying problem is that
the database has no notion of time zones at all.

- Every `timestamp(...)` column in `lib/drizzle/schema.ts` is `timestamp without
  time zone` (`{ mode: "date" }`, no `withTimezone`). No `timestamptz` exists in
  `drizzle/*.sql`. `start_time` / `end_time` are `time without time zone`.
- postgres-js serializes a JS `Date` with `toISOString()` (UTC) and parses OIDs
  1082/1114/1184 with `new Date(x)`. A value written as a UTC string into a
  zone-less column is read back as a bare wall-clock string and interpreted in
  the *process's* local zone. Bogotá sees a 5-hour skew; CI (UTC) hides it.
- Code compensates with local getters (`startOfDay`, `atTime`), an
  `isAllDayDate` midnight heuristic, and an explicit `allDay` boolean threaded
  through DTOs. These are mitigations, not a fix.
- The form builds local `Date`s and submits `toISOString()`; the write path does
  `new Date(startDate)`. The moment is lost and reconstructed in the wrong zone.

The trigger was an assignment window coming back empty. The goal is to stop
compensating and make time unambiguous in storage and in presentation.

## Goals

- Every instant stored for project work is an unambiguous point in time.
- Each project has an explicit IANA time zone. All project-scoped dates and
  times are entered, calculated and displayed in that zone, for every viewer.
- A user in Spain looking at a Colombian project sees `24/12/2026 09:00` labelled
  as Colombia time — not a conversion to their own zone.
- Recurrence and all-day rules keep working across DST changes.
- No offset arithmetic, no "midnight means all-day" heuristics, no `allDay`
  workaround in DTOs.

## Non-goals (this session)

- Time zones for non-project data: invoices without a project, client
  activities, reminders, users, stores, auth/session rows. Those keep their
  current columns.
- Per-user or per-browser display zones. The project zone is authoritative.
- Country → zone autodetection from the browser. Country only suggests a
  default; the user picks the zone.

## Anti-goals

- Storing a bare wall-clock timestamp and relying on the server's `TZ`.
- Hand-rolled offset math with `Intl.DateTimeFormat(...).formatToParts()`.
- Keeping the `allDay` DTO flag as the source of truth for all-day tasks.

## Constraints and decisions already made

- **Runtime**: use native Temporal, no polyfill. Node 26 ("Lithium") entered
  Active LTS on 2026-10-28 (supported to 2029-04-30) and enables Temporal by
  default. Today's runtimes do not: local Node 23.11 has `Temporal === undefined`
  without `--harmony-temporal`, and CI pins Node 22. The upgrade is part of this
  work: add `.nvmrc` with 26, set `engines.node`, change CI `node-version` to 26,
  and verify the deployment host can run Node 26 before implementation starts.
  The human partner's call is that LTS versions are broadly supported by
  providers; if the host turns out to be pinned, this design must be revisited.
  TypeScript 6 already ships Temporal types (`lib.esnext.temporal.d.ts`).
- **Temporal stays server-side**. Browser support is still incomplete (Safari
  partial, Edge experimental). Forms submit plain date/time strings; server
  actions do the conversion. Display uses `Intl.DateTimeFormat` with an explicit
  `timeZone`, which is universally supported.
- **Scope**: `projects`, `project_membership`, `task`, `task_assignment`,
  `task_assignee`, `task_comment`, `expense`, and the two assignment views.
- **Project zone is the only resolution rule** inside this scope. No chain to
  user/store zones is needed because every row in scope has a `project_id`.

## Design

### 1. Data model

`lib/drizzle/schema.ts`:

- Add `timeZone: text("time_zone").notNull()` to `projectsTable`. Store the IANA
  identifier (e.g. `America/Bogota`), validated with
  `Intl.supportedValuesOf("timeZone")`. Add a check constraint or enforce in the
  Zod input schema; the action schema is the primary guard.
- Change every project-scoped `timestamp("...", { mode: "date" })` to
  `timestamp("...", { mode: "date", withTimezone: true })`, including
  `created_at` / `updated_at` on those tables. Concretely: `projects`,
  `project_membership`, `task.start_date/end_date`,
  `task_assignment.start_date/end_date`, `task_assignee`, `task_comment`,
  `expense`. The assignment detail/latest SQL views reference these columns and
  already declare `sql<Date>`; they need no type change, only regeneration.
- Keep `date(...)` columns as `date` (`project.start_date/end_date`,
  `expense.expense_date`, invoice/client dates). They are calendar dates with no
  time-of-day and need no zone.
- Keep `time("start_time")` / `time("end_time")` as `time without time zone`.
  A time-of-day is wall-clock in the project zone; `timetz` carries no date, so
  its offset cannot be resolved across DST — it is a Postgres anti-pattern. The
  project zone supplies the missing context. **This is my call** for the builder;
  it is not a leftover workaround.
- Add a `COUNTRY_TIMEZONES: Record<ProjectCountry, string[]>` table beside
  `COUNTRY_FORMAT` in `lib/projects/location.ts`, listing the IANA zones for
  each of the 32 supported countries. The project form uses it to suggest a
  default zone when a country is chosen; the zone field stays editable. Changing
  the country re-suggests the default but never silently overwrites an explicit
  choice. **My call.**

Migration (`pnpm db:generate`, never hand-edit `drizzle/`):

- Existing zone-less values were written as UTC wall clocks by postgres-js.
  Convert with `USING column AT TIME ZONE 'UTC'`. Before applying, verify with
  `SHOW timezone;` on the target database and spot-check a known row; if the
  session zone was not UTC, use that zone instead. Also audit every write path
  into these columns: in-repo seeds use `new Date("...Z")` through Drizzle and
  postgres-js (`lib/drizzle/seed-e2e.ts:216-217`), and there are no raw `INSERT`
  statements into project tables in the repo; any external imports or manual SQL
  edits must be checked individually. **This assumption is the main migration
  risk and must be verified, not guessed.**
- Backfill `projects.time_zone` in the same migration: derive from `country`
  using the first candidate in `COUNTRY_TIMEZONES`, defaulting to `UTC` when a
  country has no mapping. Then set the column `NOT NULL`.

### 2. Server-side date math

Create a single zone-aware boundary in `lib/` (e.g. `lib/time/zone.ts`) with
native Temporal:

- `toInstant(wallClock: { date: string; time?: string | null }, timeZone: string): Temporal.Instant`
  using `Temporal.PlainDateTime.from(...).toZonedDateTime(timeZone, {
  disambiguation: "compatible" })`. `compatible` shifts nonexistent spring-forward
  times forward and picks the earlier offset for ambiguous fall-back times;
  that is the documented, predictable choice. **My call.**
- `toWallClock(instant, timeZone): { date: string; time: string }` via
  `Temporal.Instant.from(...).toZonedDateTimeISO(timeZone)`.
- `zonedNow(timeZone)`, `addDays`, `startOfWeek`, `atTime` equivalents working on
  `Temporal.ZonedDateTime`, so arithmetic crosses DST correctly.

Move the canonical scheduling math in `lib/tasks/recurrence.ts`,
`lib/tasks/assignments.ts` and `lib/util/schedule.ts` onto those helpers. Keep
the existing function names and exported shapes where callers depend on them;
the implementation swaps `Date`/local getters for `ZonedDateTime`. Continue to
pass explicit zones — never read `process.env.TZ` or the host zone.

All-day tasks keep `startTime === null` as the authoritative flag. An all-day
slot is an instant at `00:00` in the project zone, displayed date-only. Delete
`isAllDayDate`, the midnight heuristic in `isTaskOverdue`, and the optional
`allDay` boolean from `formatDueDate` / `formatAssignmentDueDate` /
`TaskAssignmentDTO`; callers already have `startTime`. The form may keep an
`allDay` UI switch, but it produces empty time strings, not a DTO flag.

### 3. Boundaries

- **Write**: the task form submits `{ date: "YYYY-MM-DD", time: "HH:mm" | null }`
  strings instead of `toISOString()`. The server action loads the project's
  `timeZone`, converts with `toInstant`, and writes a JS `Date` to the
  `timestamptz` column. postgres-js then writes a true UTC instant.
- **Read**: `timestamptz` comes back from postgres-js as a real `Date`. The
  action formats it with `Intl.DateTimeFormat` using the project zone, or passes
  it to a client component with the zone string so the client formats with the
  same explicit zone. No component ever calls `new Date("YYYY-MM-DD")`.
- **Query**: calendar range comparisons (`actions/calendar/queries.ts` uses
  `toISOString()` bounds) now compare real instants. Re-check every `sql`
  fragment that compares a date column against a string.
- **Recurrence / assignment creation**: `firstAssignmentWindow` and
  `computeNextOccurrence` must never silently produce a null window for a valid
  schedule. When no slot exists, surface an error through the normal action
  error path instead of inserting a null-dated assignment. This closes the
  original incident explicitly.

### 4. Presentation

- `components/projects/due-date.tsx`, `components/projects/tasks/tasks-table.tsx`,
  `task-open-assignment-rows.tsx`, `task-closed-assignment-rows.tsx`,
  `task-history-panel.tsx`, `components/my-tasks/my-tasks-list.tsx` and the
  calendar view receive a `timeZone` prop (from the project carried in the DTO)
  and format with that zone. Cross-project lists are not an exception: every
  row belongs to a project, so `MyAssignmentDTO` must carry that row's
  `timeZone` and task `startTime` (for the all-day flag) and each row formats in
  its own project zone. There is no single app-wide display zone.
- Format: localised date and time via `Intl.DateTimeFormat(locale, { dateStyle:
  "short", timeStyle: "short", timeZone, timeZoneName: "short" })`. All-day
  entries omit the time. Add one translation key for the zone label rather than
  hard-coding "Colombia time"; check `messages/` for an existing term first and
  keep `en.json` / `es.json` structurally identical. **My call** on the exact
  format; the builder may choose a clearer label after seeing it rendered.
- `components/projects/project-details.tsx`, `project-card.tsx` and
  `project-form.tsx` show / edit the project zone next to country.

Decisions from review:

- **Cross-project calendar** (`/app/calendario`): there is no single grid zone.
  Each event is placed on the date it has in its own project's zone and labelled
  with that zone. `buildCalendarEvents` derives the day key from the event's
  project zone, and range queries must widen bounds enough not to drop events
  whose project-zone date differs from the host-zone date. A fixed grid zone is
  rejected because it would push late-evening events into the wrong day column.
- **My Tasks** rows each format in their row's project zone (see above).
- **Editing a project's zone preserves the instant**, not the wall clock. It is
  a metadata change: stored timestamps are untouched and every display shifts
  to the new zone. A project's location is fixed in practice, so this happens
  only when an initial zone was wrong; correcting such a mistake is a separate
  one-off data operation, not part of this work. Rewriting all project-scoped
  timestamps on every zone edit is explicitly rejected as too demanding and
  destructive of history.

### 5. Tests

- Unit tests beside the helpers. Assertions use explicit zones, so results are
  identical whether the host runs UTC or Bogotá. Add cases for:
  - all-day midnight stored as an instant and read back in another zone;
  - a 9:00 project-zone task viewed from a different zone;
  - a weekly recurrence crossing a DST boundary (`America/New_York`,
    `Europe/Madrid`) and a zone without DST (`America/Bogota`);
  - ambiguous / nonexistent local times under `disambiguation: "compatible"`;
  - `firstAssignmentWindow` returning an error path rather than a null window.
- Run `pnpm verify` under `TZ=UTC` and `TZ=America/Bogota` (and the existing
  suite in CI) to prove no host-zone dependence remains. Do not hard-code UTC-5
  offsets in assertions — use zoned conversions.
- Update `lib/drizzle/seed-e2e.ts` fixtures for the new columns and add an e2e
  check that a task created in a project displays in the project zone.

## Risks

- The migration depends on the "stored wall clock is UTC" assumption. Verify
  against real data before applying.
- Country → zone lists need maintenance if the country set expands.
- Node 26 must be available on the deployment host; if it is not, the whole
  approach needs revisiting before implementation.

## What is left to the builder

The detailed file-by-file change list, exact component prop plumbing, the
country → zone table contents, translation keys, and the order of the migration
steps. All product decisions above are settled; anything marked **my call** is
a default the builder may refine without asking.
