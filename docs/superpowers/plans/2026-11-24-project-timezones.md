# Project Time Zones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every project-scoped timestamp an unambiguous instant, with each project's IANA zone governing input, recurrence and display, using native Temporal on Node 26.

**Architecture:** Native `Temporal` (Node 26 LTS, server-side only) becomes the single zone-aware boundary. Forms submit wall-clock date/time strings; server actions convert them to instants using the project's zone and write `timestamptz`. Reads format instants in the same zone with `Intl.DateTimeFormat`; cross-project surfaces use each row's own project zone. No polyfill, no offset arithmetic.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Drizzle ORM + postgres-js, native `Temporal`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-project-timezones-design.md`

## Global Constraints

- Node 26 ("Lithium", Active LTS) is the runtime floor; native `Temporal` only, no `@js-temporal/polyfill` or other new dependency.
- The project zone is the only resolution rule for project-scoped rows. No user/store zones this session.
- `time` columns stay `time without time zone`; `date` columns stay `date`; only `timestamp` columns become `timestamptz`.
- All-day is `startTime === null`. Never infer all-day from an instant's hour.
- Never read `process.env.TZ` or host-local getters in zone-aware code; pass an explicit IANA zone.
- Migrations are generated with `pnpm db:generate` / `pnpm drizzle-kit generate --custom`; never hand-edit `drizzle/`.
- `messages/en.json` and `messages/es.json` stay structurally identical; reuse an existing key before adding one.
- One component per file; `useCallback` for handlers of two lines or more; semantic Tailwind tokens only.
- **Do not commit or push.** The repository rules require explicit permission; end each task with a diff review and ask before committing.
- Verify with `pnpm verify`; E2E with `pnpm test:e2e` (Docker test DB).

## Review Focus

These inputs are implied by the spec but no single task's happy path covers them. Each is pinned to a test in the owning task below.

- Ambiguous and nonexistent local times at a DST boundary — 09:00 on a spring-forward gap must resolve by `disambiguation: "compatible"` the same way everywhere → Task 3.
- An all-day midnight in `America/Bogota` viewed from Europe must show the project's calendar date, not a shifted one → Tasks 3 and 8.
- A late-evening event whose project-zone date is tomorrow in UTC must stay on its project-zone day column → Task 9.
- Legacy zone-less rows written with a non-UTC session time zone would be silently shifted by the migration → Task 4 verification step.
- Editing a project's zone must leave stored instants untouched (display relabels) → Task 5.
- A valid repeating schedule whose window helper returns no slot must surface an action error, not insert null-dated assignments → Task 7.

---

### Task 1: Node 26 runtime prerequisite

**Files:**
- Create: `.nvmrc`
- Modify: `package.json` (add `engines`)
- Modify: `.github/workflows/ci.yml:18`

**Interfaces:**
- Consumes: nothing.
- Produces: `engines.node >= 26`, CI Node 26, local Node 26 with native `Temporal`.

- [ ] **Step 1: Make the change**

`.nvmrc` contains `26`. `package.json` gets `"engines": { "node": ">=26" }`. CI `node-version` becomes `26`. Install/switch to Node 26 locally (the current 23.11 does not expose `Temporal`).

- [ ] **Step 2: Verify**

Run: `node -v && node -e "console.log(typeof Temporal)" && pnpm typecheck`
Expected: `v26.x`, then `object`, then a clean typecheck.

- [ ] **Step 3: Review the diff and ask before committing**

---

### Task 2: Country → zone catalog

**Files:**
- Modify: `lib/projects/location.ts`
- Test: `lib/projects/location.test.ts`

**Interfaces:**
- Consumes: `PROJECT_COUNTRIES`, `ProjectCountry` from `lib/projects/location.ts`.
- Produces:
  - `COUNTRY_TIMEZONES: Record<ProjectCountry, string[]>`
  - `defaultTimeZoneForCountry(country: ProjectCountry): string`
  - `isSupportedTimeZone(value: string): boolean`

- [ ] **Step 1: Write failing tests** in `lib/projects/location.test.ts`

Assertions: every key of `PROJECT_COUNTRIES` has a non-empty zone list; `defaultTimeZoneForCountry("CO") === "America/Bogota"`; a country with several zones (e.g. `US` or `BR`) returns more than one candidate; `isSupportedTimeZone("America/Bogota") === true`; `isSupportedTimeZone("Mars/Olympus") === false`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/projects/location.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

Add the map using IANA identifiers accepted by `Intl.supportedValuesOf("timeZone")`. `defaultTimeZoneForCountry` returns the first candidate, falling back to `"UTC"` for a stale/unknown country. `isSupportedTimeZone` uses `Intl.supportedValuesOf("timeZone")` membership.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/projects/location.test.ts`
Expected: PASS.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 3: Zone-aware primitives

**Files:**
- Create: `lib/time/zone.ts`
- Create: `lib/time/zone.test.ts`

**Interfaces:**
- Consumes: native `Temporal`.
- Produces (all conversions use `disambiguation: "compatible"`):
  - `wallClockToInstant(dateKey: string, time: string | null, timeZone: string): Temporal.Instant | null`
  - `instantToWallClock(instant: Date | Temporal.Instant, timeZone: string): { date: string; time: string }`
  - `zonedDateKey(instant: Date | Temporal.Instant, timeZone: string): string`
  - `zonedNow(timeZone: string): Temporal.ZonedDateTime`
  - `startOfZonedDay(instant: Date | Temporal.Instant, timeZone: string): Temporal.ZonedDateTime`
  - `atZonedTime(day: Temporal.ZonedDateTime, time: string | null): Temporal.ZonedDateTime`
  - `addZonedDays(day: Temporal.ZonedDateTime, days: number): Temporal.ZonedDateTime`

- [ ] **Step 1: Write failing tests** in `lib/time/zone.test.ts`

Assertions:
- `wallClockToInstant("2026-11-25", "09:00", "America/Bogota")` equals the instant of `2026-11-25T14:00:00Z`; the same wall clock in `Europe/Madrid` equals `2026-11-25T08:00:00Z` (winter).
- `instantToWallClock` round-trips that instant back to `{ date: "2026-11-25", time: "09:00" }` in Bogotá.
- `wallClockToInstant("2026-03-08", "02:30", "America/New_York")` resolves forward under compatible disambiguation; assert the result's wall clock is a real time and the UTC offset is `-04:00`.
- `zonedDateKey(new Date("2026-11-25T02:00:00Z"), "America/Bogota") === "2026-11-24"` while `zonedDateKey(..., "UTC") === "2026-11-25"`.
- `addZonedDays(startOfZonedDay(new Date("2026-11-01T12:00:00Z"), "America/New_York"), 2)` keeps wall-clock midnight.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run lib/time/zone.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** the seven functions in `lib/time/zone.ts`.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/time/zone.test.ts`
Expected: PASS under both `TZ=UTC` and `TZ=America/Bogota` (`TZ=UTC pnpm vitest run ...` and `TZ=America/Bogota pnpm vitest run ...`).

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 4: Storage migration and schema

**Files:**
- Modify: `lib/drizzle/schema.ts` (project `time_zone`, `withTimezone: true` on all project-scoped timestamps, `startTime` added to `taskAssignmentDetailView`)
- Create: the generated `drizzle/00NN_*.sql` and its `--custom` backfill migration (names come from `drizzle-kit`)

**Interfaces:**
- Consumes: `COUNTRY_TIMEZONES` from Task 2 (mirrored as a SQL `CASE` in the backfill).
- Produces: `projects.time_zone` (text, NOT NULL) and `timestamptz` columns; view rows expose `start_time`.

- [ ] **Step 1: Verify the migration assumption before generating**

Run: `SHOW timezone;` against the target database and inspect one known `task.start_date` row. Expected: `UTC` and a UTC wall clock. If not, stop and agree a different `AT TIME ZONE` source before continuing.

- [ ] **Step 2: Make the schema change**

Add `timeZone: text("time_zone").notNull()` to `projectsTable`. Add `{ withTimezone: true }` to every `timestamp(...)` on `projects`, `project_membership`, `task`, `task_assignment`, `task_assignee`, `task_comment`, `expense`. Add `startTime: sql<string | null>`${tasksTable.startTime}`` to `taskAssignmentDetailView`. Regenerate the SQL view definitions if drizzle-kit requires it.

- [ ] **Step 3: Generate and review migrations**

Run: `pnpm db:generate`, then `pnpm drizzle-kit generate --custom` for the backfill. Review the generated SQL: every conversion preserves the UTC instant (`AT TIME ZONE 'UTC'` semantics), and the backfill sets `time_zone` for every existing project before `NOT NULL` is enforced. Never edit the generated files by hand.

- [ ] **Step 4: Verify**

Run: `pnpm test:db:setup && pnpm typecheck`
Expected: test DB migrates and seeds cleanly; typecheck passes.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 5: Project zone field end-to-end

**Files:**
- Modify: `actions/projects/schemas.ts` (`ProjectSchema`, `ProjectRecordSchema`, `ProjectSummarySchema`), `actions/projects/queries.ts`, `components/projects/project-form.tsx`, `components/projects/project-details.tsx`, `components/projects/project-card.tsx`
- Test: `actions/projects/projects.test.ts`

**Interfaces:**
- Consumes: `COUNTRY_TIMEZONES`, `defaultTimeZoneForCountry`, `isSupportedTimeZone` from Task 2; `projects.time_zone` from Task 4.
- Produces: `ProjectDTO.timeZone: string` present in every project schema; the form edits it.

- [ ] **Step 1: Write failing tests** in `actions/projects/projects.test.ts`

Assertions: creating a project with `country: "CO"` and no `timeZone` stores `America/Bogota`; creating with an explicit supported `timeZone` stores that value; creating with `timeZone: "Mars/Olympus"` is rejected; updating only `timeZone` leaves every task/assignment timestamp unchanged (list one timestamp before and after).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run -t "time zone" actions/projects/projects.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add `timeZone` to the input schema (defaulted from `country` when absent, validated with `isSupportedTimeZone`) and to the record/summary schemas. Thread it through create/update queries. In the form, add a zone select beside country: choosing a country re-suggests `defaultTimeZoneForCountry` but never overwrites an explicit user choice. Show the zone in details and card.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run actions/projects/projects.test.ts`
Expected: PASS.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 6: Zone-aware scheduling core

**Files:**
- Modify: `lib/util/schedule.ts`, `lib/tasks/recurrence.ts`, `lib/tasks/assignments.ts`, `lib/util/tasks.ts`
- Test: `lib/util/schedule.test.ts`, `lib/tasks/recurrence.test.ts`, `lib/tasks/assignments.test.ts`, `lib/util/tasks.test.ts`

**Interfaces:**
- Consumes: Task 3 primitives.
- Produces (every function gains a required `timeZone: string` argument):
  - `computeScheduledFor(from, schedule, timeZone, options?)`
  - `firstOccurrenceAnchor(task, timeZone, now = new Date())`
  - `computeNextOccurrence(task, after, timeZone, options?)`
  - `atTime(date, time, timeZone)`
  - `firstAssignmentWindow(task, timeZone)`
  - `isTaskOverdue(status, dueDate, timeZone, allDay)`
  - `formatDueDate(date, locale, timeZone, startTime: string | null)`
  - `formatAssignmentDueDate(date, locale, timeZone, startTime)`

  `parseISODate`, `toDateKey`, `startOfDay`, `endOfDay`, `combineDateTime` stay as wall-clock helpers for the client form; they never interpret an instant.

- [ ] **Step 1: Write failing tests**

- `lib/tasks/recurrence.test.ts`: the same weekly 09:00 schedule in `America/New_York` produces an occurrence one calendar week later across the March DST change at the same wall-clock hour, while `America/Bogota` keeps a fixed offset.
- `lib/tasks/assignments.test.ts`: `firstAssignmentWindow` for an all-day task in Bogotá has a start at project-zone midnight, and `atTime(..., null, zone)` preserves the day.
- `lib/util/tasks.test.ts`: `isTaskOverdue` with an all-day deadline is false at 08:00 project time on the due day and true the next day; `formatDueDate` in Bogotá renders `Nov 25` for an instant that is already 25 Nov UTC but 24 Nov in Bogotá.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run lib/tasks/recurrence.test.ts lib/tasks/assignments.test.ts lib/util/tasks.test.ts`
Expected: FAIL — new argument not accepted / values shifted.

- [ ] **Step 3: Implement**

Replace internal `Date`/local-getter arithmetic with Task 3 primitives; keep the exported shapes (`Date` where callers expect `Date`). Delete `isAllDayDate` and the midnight heuristic; all-day comes from the `startTime` argument. Use `disambiguation: "compatible"` only inside Task 3.

- [ ] **Step 4: Run to verify they pass**

Run: `TZ=UTC pnpm vitest run lib/tasks/recurrence.test.ts lib/tasks/assignments.test.ts lib/util/tasks.test.ts` and `TZ=America/Bogota pnpm vitest run ...`
Expected: PASS in both zones.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 7: Task write path and DTOs

**Files:**
- Modify: `components/projects/tasks/task-form.tsx`, `actions/tasks/schemas.ts`, `actions/tasks/actions.ts`, `actions/tasks/queries.ts`
- Test: `actions/tasks/tasks.test.ts`, `actions/tasks/schemas.test.ts`

**Interfaces:**
- Consumes: `wallClockToInstant` from Task 3; Task 6 signatures; `ProjectDTO.timeZone` from Task 5.
- Produces: `TaskFormDTO.startDate/endDate` are wall-clock strings (`YYYY-MM-DD`); `TaskAssignmentDTO` and `MyAssignmentDTO` carry `timeZone` and `startTime`, no `allDay`.

- [ ] **Step 1: Write failing tests** in `actions/tasks/tasks.test.ts`

Assertions:
- Creating a 09:00 task in project `America/Bogota` stores the instant `14:00Z`; the same form values in `Europe/Madrid` store `08:00Z`.
- Creating an all-day task submits `startTime: ""` and produces a project-zone midnight instant.
- A repeating schedule with no valid slot produces an action error and no assignment row with null dates (the original incident).
- `MyAssignmentDTO` rows from two projects carry their own `timeZone`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run -t "time zone" actions/tasks/tasks.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

The form submits `startDate`/`endDate` as `YYYY-MM-DD` plus the existing time strings — no `toISOString()`. Server actions load `project.timeZone`, convert wall-clock values with `wallClockToInstant`, and write `Date` to `timestamptz`. Replace every scheduling call with the Task 6 signatures and pass the project zone. Replace `allDay` DTO derivation (`isAllDayWindow`) with `!startTime`; add `timeZone` and `startTime` to view selects/DTO schemas. Make `firstAssignmentWindow` failure surface through `returnActionError` instead of writing a null window.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run actions/tasks/tasks.test.ts actions/tasks/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 8: Project-zone presentation

**Files:**
- Modify: `components/projects/due-date.tsx`, `components/projects/tasks/tasks-table.tsx`, `task-open-assignment-rows.tsx`, `task-closed-assignment-rows.tsx`, `task-history-panel.tsx`, `components/my-tasks/my-tasks-list.tsx`
- Create: `components/projects/due-date.test.tsx` (uses `renderToStaticMarkup`, as in `components/common/money.test.tsx`)
- Test: `lib/util/tasks.test.ts`, `components/projects/due-date.test.tsx`

**Interfaces:**
- Consumes: `formatDueDate` / `formatAssignmentDueDate` from Task 6; `timeZone` and `startTime` from Task 7 DTOs.
- Produces: every date cell renders in its row's project zone, with a zone label.

- [ ] **Step 1: Write failing tests**

Assertions: a due date cell given a Bogotá project renders `24 nov` for an instant that is 25 Nov in UTC; a My Tasks list with rows from Bogotá and Madrid renders each row in its own zone; all-day rows render date-only and never an hour.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run lib/util/tasks.test.ts components/projects/due-date.test.tsx`
Expected: FAIL — module not found / shifted date.

- [ ] **Step 3: Implement**

Replace the `allDay` prop with `startTime` where the DTO provides it; pass `timeZone` down from the project/DTO. Format via `Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone, timeZoneName: "short" })`, omitting time for `startTime === null`. Add/reuse one translation key for the zone label in both message files. Keep each changed component in its own file.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run lib/util/tasks.test.ts components/projects/due-date.test.tsx`
Expected: PASS.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 9: Cross-project calendar

**Files:**
- Modify: `actions/calendar/schemas.ts`, `actions/calendar/queries.ts`, `actions/calendar/util.ts`, `lib/types.ts`, `lib/calendar/util/events.ts`, `components/calendar/calendar-view.tsx`
- Test: `actions/calendar/calendar.test.ts`, `lib/calendar/util/events.test.ts`

**Interfaces:**
- Consumes: `zonedDateKey` from Task 3; `timeZone` and `startTime` added to `CalendarAssignmentDTO`.
- Produces: each event grouped and labelled in its own project's zone; `CalendarEventMeta.timeZone` and `.startTime`.

- [ ] **Step 1: Write failing tests**

Assertions:
- An assignment at `2026-11-25T02:00Z` in `America/Bogota` is grouped under `2026-11-24`, while the same instant in UTC is grouped under `2026-11-25`.
- `buildCalendarEvents` derives `allDay` from `startTime === null`, never from `getHours()`.
- Range bounds from `resolveCalendarRange` are widened so an event whose project-zone date differs from the host-zone date is still returned.

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run actions/calendar/calendar.test.ts lib/calendar/util/events.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Select `projects.time_zone` and the view's `start_time` in `getProjectVisibilityRows` / `getViewAssignmentRows` and add them to `CalendarAssignmentSchema`. Build day keys with `zonedDateKey(startDate, timeZone)`. Widen `resolveCalendarRange` bounds by one day on each side (documented) and keep instant comparisons in SQL. Add `timeZone` and `startTime` to `CalendarEventMeta` and render the label in the calendar chip.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run actions/calendar/calendar.test.ts lib/calendar/util/events.test.ts`
Expected: PASS under both UTC and Bogotá.

- [ ] **Step 5: Review the diff and ask before committing**

---

### Task 10: Seed, E2E and full verification

**Files:**
- Modify: `lib/drizzle/seed-e2e.ts`, `e2e/task-assignments.spec.ts`, `e2e/project-country.spec.ts`
- Test: `pnpm verify`, `pnpm test:e2e`

**Interfaces:**
- Consumes: all of the above.
- Produces: a green full suite.

- [ ] **Step 1: Write/extend an e2e assertion**

In the project task spec, create a task in a Bogotá project and assert the displayed date matches the project's zone rather than the browser's zone; edit the project zone and assert the stored instant is unchanged (display relabels).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:e2e -- --grep "time zone"`
Expected: FAIL before the seed/fixture update.

- [ ] **Step 3: Update fixtures** in `lib/drizzle/seed-e2e.ts` for `time_zone` and `timestamptz` values, using explicit instants and IANA zones.

- [ ] **Step 4: Verify**

Run: `pnpm verify` then `pnpm test:e2e`
Expected: typecheck, lint, coverage thresholds and the Playwright smoke suite all pass. Also run `TZ=America/Bogota pnpm verify` to prove host-zone independence.

- [ ] **Step 5: Review the diff and ask before committing**
