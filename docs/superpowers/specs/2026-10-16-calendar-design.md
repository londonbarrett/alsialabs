# Calendar — Design

## Why this exists

The app's tasks and routines are scheduled things, but their schedules are only visible on project subpages, one task at a time. The calendar gives a time-oriented view of the same data: what is due this week, which routine occurrences are coming up, and how a period looks as a whole. It also doubles as a general-purpose date surface — clicking a day or an event is something callers hook into, not something the calendar decides.

To be usable in more than one place (and testable outside the app), the calendar is a portable component library under `lib/calendar/` with no knowledge of tasks, routines, or projects. App-domain meaning — what a task event is, which colors and statuses mean what — lives in the app's types and in the data-building layer. That split is the defining decision of the capability: the component renders arbitrary events; the app decides what those events are.

All user-facing calendar text comes in through props and i18n namespaces rather than being baked in, and locale behavior — especially the first day of the week — must be identical on server and client, so no part of it depends on runtime `Intl.Locale` data.

## Goals

- Provide a portable month/week/day calendar component with no app-specific logic.
- Render tasks and routines as events with meaningful colors and state styling.
- Keep event data fresh as the user navigates, without stale events from prior ranges.
- Present the calendar as a streamed, permissioned page at `/app/calendario`.

## Design

### Component boundary

The calendar lives under `lib/calendar/` — components, hooks, and utils — and is self-contained and portable. It accepts arbitrary `events`, a `locale`, `weekStartsOn`, `hourHeight`, `startHour`, `labels`, an optional `isPending` flag, and `onDateClick`/`onEventClick`/`onVisibleRangeChange` callbacks. App-domain types (task/routine projections, event meta) live in `lib/types.ts`, outside the calendar. The component never fetches or knows about tasks; it only renders the events it is given and reports interactions back through callbacks.

### Views and toolbar

The calendar has three views — month, week, and day — with month as the default when no `initialView` is passed. The toolbar carries a Today button, previous/next navigation, the current period title, and a month/week/day switcher. Toolbar labels (Today, Month, Week, Day) come from the `labels` prop so they can be translated by the caller.

Titles are human-formatted per view: month view shows the capitalized month and year ("August 2026"); week view shows full month names for both ends of the range ("August 11 – August 17, 2026"). Previous/next move one period at a time ("August 2026" to "July 2026"), and Today returns to whichever month, week, or day contains today. While `isPending` is true, a spinner renders immediately after the period title, so a caller can signal that the visible data is reloading without blanking the grid. Every navigation or view switch reports the new visible range through `onVisibleRangeChange`.

### Time grid

Week and day views render a time grid: an hourly time gutter, an all-day row, 24 hourly columns, and a vertical scroll area. The grid fills the available height and scrolls internally when content exceeds it, with no dead space below. Hour slots are `hourHeight` pixels tall, default 64. On open, the grid auto-scrolls so the working window defined by `startHour` (default 8) is visible — the "8 AM" label fully in view, not clipped.

### Today and locale

The current day is highlighted in every view with an orange badge — translucent fill `bg-orange/20`, solid `border-orange`, orange text — wrapped around the day number: in month cells, in the week-view column header (alongside the full capitalized weekday name), and in the day-view header. No other day carries the badge.

The first day of the week is derived deterministically from the locale: Sunday for `en-US`, Monday for `es`, Saturday for `ar`. The derivation deliberately avoids runtime `Intl.Locale` data so server and client renders always agree and headers never flip between passes. Weekday headers always show full, capitalized day names ("Monday", "Tuesday"), and in the "es" locale the week and month headers start with "Lunes".

### Event rendering

Events are `CalendarEvent` objects spanning the visible range, split into all-day and timed rendering. All-day events go in the all-day row using strict interval overlap (`start < dayEnd && end > dayStart`), so an event ending at exclusive midnight D+1 appears exactly once, on day D, rather than duplicating onto the following day. Timed events are positioned in the time grid at their start time, with overlapping events split into side-by-side columns so none covers another.

Month cells show up to `maxMonthEvents` (default 3) event chips, with a "+N more" affordance revealing the overflow count.

### Chip state and the detail dialog

Chips carry entity kind and task state. Task chips show a status icon colored via stroke utilities: `Check` for done/green, `X` for cancelled/red, `ArrowRightToLine` for in_progress/blue, `Eye` for in_review/yellow, `TriangleAlert` for blocked/red; cancelled task titles additionally render with strikethrough. Routine chips show a muted refresh icon before the title. Events whose end is in the past render dimmed relative to upcoming ones. Month view hides start times for app events (task/routine); grid views always show times.

Clicking a chip opens a detail dialog: for tasks, the title, schedule, project, assignee, cost, description, comments count, and status/priority badges; for routines, the recurrence summary. All dialog strings come from the `calendar` i18n namespace.

### The calendar page

`/app/calendario` is accessible to users with `projects:view` permission — anyone else gets a forbidden error. The page shows a `PageHeader` with a `CalendarDays` icon and a title/subtitle from the `calendar` i18n namespace, and the sidebar shows a "Calendar" nav item in the Navigation section after "My Tasks" (also `CalendarDays` icon) when the user holds `projects:view`.

The page streams: fast data (auth, translations) renders the shell immediately, while task and routine promises are passed to the client view and resolved under a Suspense boundary whose fallback is a pulse placeholder in the calendar area. The header never waits on the slow queries.

### Raw fetches and client-side event building

Data comes in two deliberately separate layers. `getCalendarRoutines` returns raw routine rows visible to the user — assignee, project owner/co-owner, or superuser — once per page load. `getCalendarTasks({ from, to })` returns raw task rows with a due date inside the requested range, under the same visibility rule, so a project owner who is not assigned to any of its tasks still sees all of the project's tasks and routines.

A pure client function, `buildCalendarEvents`, turns raw rows into events: it expands routine occurrences for the visible window, builds task events colored with each project's stored color (a task and a routine from the same project share that color), and hides a routine chip on any day where a task spawned by that same routine is due — the task chip remains, the routine chip does not.

Routine expansion anchors occurrences to the schedule's own start date, or a fixed epoch when absent, so occurrence days never depend on the queried range: navigating between months lands recurring routines on the same weekdays every time.

### Navigating between ranges

When the visible range changes, the client refetches tasks for the padded new window, clears stale tasks while loading — events from the previous range are hidden immediately, never shown alongside the new ones — triggers the global loading bar and the toolbar spinner, and applies only the latest response, so a fast sequence of navigations cannot end with an older range's data winning.

## Non-goals

- App-domain logic inside `lib/calendar/`. Tasks, routines, projects, and their colors stay in app types and the building layer.
- A server-side event builder. `buildCalendarEvents` runs on the client against raw rows.
- Runtime locale negotiation via `Intl.Locale`. Week start is derived deterministically to keep SSR and client identical.
- Views beyond month, week, and day, or configurable `maxMonthEvents` beyond the default behavior of capping chips with "+N more".
- Persisting the calendar's visible range or fetched tasks across page visits.
