# Calendar

## ADDED Requirements

### Requirement: Calendar with month, week, and day views

The system SHALL provide a calendar component (`lib/calendar/Calendar`) with three views: month, week, and day. The component SHALL be self-contained and portable (components, hooks, and utils under `lib/calendar/`), with no app-specific logic. It SHALL support arbitrary `events`, a `locale`, `weekStartsOn`, `hourHeight`, `startHour`, `labels`, and `onDateClick`/`onEventClick` callbacks.

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

### Requirement: Calendar navigation toolbar

The calendar SHALL provide a toolbar with a Today button, previous/next navigation, the current period title, and a month/week/day view switcher. Toolbar labels (Today, Month, Week, Day) SHALL come from the `labels` prop so they can be translated.

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

The calendar SHALL render `CalendarEvent` objects spanning the visible range, distinguishing all-day events from timed events. All-day events SHALL appear in the all-day row; timed events SHALL be positioned within the time grid with overlaps resolved by splitting the column.

#### Scenario: Timed events positioned in the grid

- **GIVEN** events within the visible day
- **WHEN** the time grid renders
- **THEN** each timed event appears as a block positioned at its start time
- **AND** overlapping events are laid out side-by-side without covering each other

#### Scenario: All-day events in the all-day row

- **GIVEN** an all-day event within the visible range
- **WHEN** the time grid renders
- **THEN** the event appears in the all-day row as a chip with a colored dot

#### Scenario: Month view events and "+N more"

- **GIVEN** a month day with more events than `maxMonthEvents` (default 3)
- **WHEN** the month view renders that cell
- **THEN** up to 3 event chips are shown
- **AND** a "+N more" affordance reveals the overflow count

### Requirement: Calendar page

The system SHALL provide a demo calendar page at `/dashboard/calendar` accessible to users with `projects:view` permission. It SHALL show a PageHeader with a CalendarDays icon and a title/subtitle from the `calendar` i18n namespace.

#### Scenario: Calendar page requires projects:view

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to `/dashboard/calendar`
- **THEN** a forbidden error is returned

#### Scenario: Calendar sidebar link

- **GIVEN** the sidebar renders with `projects:view` permission
- **THEN** a "Calendar" nav item appears in the Navigation section after "My Tasks"
- **AND** it uses a CalendarDays icon
- **AND** clicking it navigates to `/dashboard/calendar`

### Requirement: Calendar event data source

A server action (`getCalendarEvents`) SHALL produce the events for the calendar: the user's tasks with a due date, plus occurrences of the user's routines within a ±90-day window around today. Task colors SHALL be derived deterministically from the project id; routine events SHALL use a teal color.

#### Scenario: Tasks with due dates become events

- **GIVEN** a task with a due date within the window
- **WHEN** `getCalendarEvents` runs
- **THEN** the tasks appears as an event whose color derives from its project

#### Scenario: Routine occurrences expand into events

- **GIVEN** a recurring routine with a schedule within the window
- **WHEN** `getCalendarEvents` runs
- **THEN** each occurrence is emitted as a teal event