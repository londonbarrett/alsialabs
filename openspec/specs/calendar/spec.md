# Calendar

### Requirement: Calendar with month, week, and day views

The system SHALL provide a calendar component (`lib/calendar`) with three views: month, week, and day. The component SHALL be self-contained and portable (components, hooks, and utils under `lib/calendar/`), with no app-specific logic: app-domain types (task/routine projections, event meta) SHALL live in `lib/types.ts`. It SHALL support arbitrary `events`, a `locale`, `weekStartsOn`, `hourHeight`, `startHour`, `labels`, an optional `isPending` flag, and `onDateClick`/`onEventClick`/`onVisibleRangeChange` callbacks.

#### Scenario: Calendar renders month view by default

- **GIVEN** the calendar is rendered with no `initialView`
- **THEN** the calendar displays the month view
- **AND** the toolbar title shows the current month and year capitalized (e.g., "August 2026")

#### Scenario: Calendar switches between views

- **GIVEN** the calendar is rendered
- **WHEN** the user selects the week view
- **THEN** the calendar displays a 7-day time grid
- **WHEN** the user selects the day view
- **THEN** the calendar displays a single-day time grid

#### Scenario: Visible range changes are reported

- **GIVEN** the calendar is rendered with an `onVisibleRangeChange` callback
- **WHEN** the user navigates to another period or switches views
- **THEN** the callback receives the new visible range start/end

### Requirement: Calendar navigation toolbar

The calendar SHALL provide a toolbar with a Today button, previous/next navigation, the current period title, and a month/week/day view switcher. Toolbar labels (Today, Month, Week, Day) SHALL come from the `labels` prop so they can be translated. While `isPending` is true, a spinner SHALL appear next to the period title.

#### Scenario: Navigate to previous period

- **GIVEN** the calendar is in month view showing "August 2026"
- **WHEN** the user clicks the previous button
- **THEN** the calendar shows "July 2026"

#### Scenario: Return to today

- **GIVEN** the calendar is navigated to a past month
- **WHEN** the user clicks the "Today" button
- **THEN** the calendar displays the current month/week/day containing today

#### Scenario: Week paginator shows full month names

- **GIVEN** the calendar is in week view
- **THEN** the toolbar title shows full month names for both dates (e.g., "August 11 – August 17, 2026")

#### Scenario: Spinner while loading

- **GIVEN** the calendar is rendered with `isPending = true`
- **WHEN** the toolbar renders
- **THEN** a spinning loader icon appears immediately after the period title

### Requirement: Time grid

The week and day views SHALL render a time grid with an hourly time gutter, an all-day row, 24 hourly columns, and a vertical scroll area. The grid SHALL fill the available height and scroll vertically when content exceeds it. Hour slots SHALL be `hourHeight` pixels tall (default 64).

#### Scenario: Time grid fills available height and scrolls

- **GIVEN** the calendar is in week view
- **WHEN** the grid has more content than the visible area
- **THEN** the time grid scrolls vertically within the component
- **AND** no dead space appears below the grid

#### Scenario: Grid auto-scrolls to the start hour

- **GIVEN** the calendar is in week or day view with default `startHour = 8`
- **WHEN** the view opens
- **THEN** the grid scrolls so the working window (8:00–18:00) is visible
- **AND** the "8 AM" hour label is fully visible (not clipped)

### Requirement: Today indicator

The current day SHALL be visually highlighted in all views using an orange badge (translucent fill `bg-orange/20`, solid `border-orange`, orange text) around the day number.

#### Scenario: Today in month view

- **GIVEN** the calendar is in month view
- **WHEN** today's cell renders
- **THEN** today's day number is wrapped in the orange badge
- **AND** other day numbers have no badge

#### Scenario: Today in week view header

- **GIVEN** the calendar is in week view
- **WHEN** the header renders the column for today
- **THEN** today's day number carries the orange badge
- **AND** the weekday label shows the full, capitalized day name

#### Scenario: Today in day view header

- **GIVEN** the calendar is in day view showing today
- **WHEN** the header renders
- **THEN** the day number carries the orange badge next to the full weekday name

### Requirement: Locale-aware week start

The first day of the week SHALL be derived deterministically from the locale (e.g., Sunday for `en-US`, Monday for `es`, Saturday for `ar`). The derivation SHALL NOT depend on runtime `Intl.Locale` data so server and client renders always agree.

#### Scenario: Weekday header order matches locale

- **GIVEN** the calendar locale is "es"
- **THEN** the week/month weekday headers start with "Lunes" (Monday)
- **GIVEN** the calendar locale is "en-US"
- **THEN** the weekday headers start with "Sunday"

#### Scenario: Header labels are full and capitalized

- **GIVEN** the calendar is in month view
- **THEN** weekday headers show full day names, capitalized (e.g., "Monday", "Tuesday")

### Requirement: Calendar events

The calendar SHALL render `CalendarEvent` objects spanning the visible range, distinguishing all-day events from timed events. All-day events SHALL appear in the all-day row using strict interval overlap (`start < dayEnd && end > dayStart`) so an event's exclusive midnight end does not duplicate it onto the following day. Timed events SHALL be positioned within the time grid with overlaps resolved by splitting the column.

#### Scenario: Timed events positioned in the grid

- **GIVEN** events within the visible day
- **WHEN** the time grid renders
- **THEN** each timed event appears as a block positioned at its start time
- **AND** overlapping events are laid out side-by-side without covering each other

#### Scenario: All-day events appear only on covered days

- **GIVEN** an all-day event starting on day D (end at midnight D+1)
- **WHEN** the week grid renders days D and D+1
- **THEN** the event appears exactly once, on day D

#### Scenario: Month view events and "+N more"

- **GIVEN** a month day with more events than `maxMonthEvents` (default 3)
- **WHEN** the month view renders that cell
- **THEN** up to 3 event chips are shown
- **AND** a "+N more" affordance reveals the overflow count

### Requirement: Event chip state styling

Event chips SHALL convey entity kind and task state: task chips show a status icon (`Check` done/green, `X` cancelled/red, `ArrowRightToLine` in_progress/blue, `Eye` in_review/yellow, `TriangleAlert` blocked/red) colored via stroke utilities; cancelled task titles render with strikethrough; routine chips show a muted refresh icon before the title; events whose end is in the past render dimmed. Month view hides start times for app events (task/routine); grid views always show times.

#### Scenario: Status icons per task state

- **GIVEN** tasks with statuses done, cancelled, in_progress, in_review, and blocked
- **WHEN** their chips render
- **THEN** each shows the matching status icon in the status color
- **AND** cancelled tasks additionally show a strikethrough title

#### Scenario: Past events dimmed

- **GIVEN** an event whose end time has passed
- **WHEN** its chip renders in any view
- **THEN** the chip is dimmed relative to upcoming events

### Requirement: Event detail dialog

Clicking an event chip SHALL open a detail dialog showing the event's information (title, schedule, project, assignee, cost, description, comments count for tasks; recurrence details for routines). Dialog strings SHALL come from the `calendar` i18n namespace.

#### Scenario: Opening task details

- **GIVEN** a task event chip
- **WHEN** the user clicks it
- **THEN** a dialog opens with the task's details and status/priority badges

#### Scenario: Opening routine details

- **GIVEN** a routine occurrence chip
- **WHEN** the user clicks it
- **THEN** a dialog opens with the routine's recurrence summary

### Requirement: Calendar page

The system SHALL provide a calendar page at `/dashboard/calendar` accessible to users with `projects:view` permission. It SHALL show a PageHeader with a CalendarDays icon and a title/subtitle from the `calendar` i18n namespace. The page SHALL stream: fast data (auth, translations) renders the shell immediately while task/routine promises are passed to the client view and resolved under a Suspense boundary with a pulse fallback.

#### Scenario: Calendar page requires projects:view

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to `/dashboard/calendar`
- **THEN** a forbidden error is returned

#### Scenario: Calendar sidebar link

- **GIVEN** the sidebar renders with `projects:view` permission
- **THEN** a "Calendar" nav item appears in the Navigation section after "My Tasks"
- **AND** it uses a CalendarDays icon
- **AND** clicking it navigates to `/dashboard/calendar`

#### Scenario: Shell streams before data resolves

- **GIVEN** the calendar page is loading
- **WHEN** task or routine queries are still pending
- **THEN** the header renders immediately and a pulse placeholder occupies the calendar area until the queries resolve

### Requirement: Calendar event data source

Raw data SHALL be served separately from event building:

- `getCalendarRoutines` SHALL return raw routine rows visible to the user (assignee, project owner/co-owner, or superuser) once per page load.
- `getCalendarTasks({ from, to })` SHALL return raw task rows with a due date inside the requested range, visible to the user under the same rule (assignee, project owner/co-owner, or superuser).
- A pure client function (`buildCalendarEvents`) SHALL expand routine occurrences for the visible window, build task events colored with each project's stored color, and hide a routine chip on any day where a task spawned by the same routine is due.

Routine expansion SHALL anchor occurrences to the schedule's own start date (or a fixed epoch when absent) so occurrence days never depend on the queried range. On visible-range change the client SHALL refetch tasks for the padded visible window, clear stale tasks while loading, trigger the global loading bar and the toolbar spinner, and apply only the latest response.

#### Scenario: Tasks with due dates become events

- **GIVEN** a visible task with a due date inside the fetched range
- **WHEN** events are built
- **THEN** the task appears as an event whose color is the stored color of its project

#### Scenario: Task and routine from the same project share one color

- **GIVEN** a task and a routine belonging to the same project
- **WHEN** events are built for both
- **THEN** both events use that project's stored color

#### Scenario: Routine occurrences stay consistent across ranges

- **GIVEN** a recurring routine every N days with a fixed start date
- **WHEN** the user navigates between different months
- **THEN** occurrences land on the same weekdays/days regardless of the queried range

#### Scenario: Routine hidden where its task already exists

- **GIVEN** a routine that spawned a task due on day D
- **WHEN** events for a range containing D are built
- **THEN** the routine chip for day D is hidden and the task chip remains

#### Scenario: Project owners see project tasks

- **GIVEN** a user who owns (or co-owns) a project but is not assigned to its tasks
- **WHEN** the calendar fetches tasks or routines
- **THEN** all of the project's tasks and routines are included

#### Scenario: Stale events cleared during navigation

- **GIVEN** events from the previous range are displayed
- **WHEN** the user navigates to another period
- **THEN** stale events are hidden immediately while the new range loads
- **AND** only the freshly loaded events for that range are shown afterwards
