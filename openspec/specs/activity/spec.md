# activity Specification

## Purpose

The activity page: inactive-client tracking, reminders, per-client recent activities, and the activity-page store.

## Requirements

### Requirement: Access control

The activity page SHALL only be accessible to users with the `activity:view` permission.

#### Scenario: User with permission can access activity

- **WHEN** a user with `activity:view` permission visits `/app/actividad`
- **THEN** the activity page SHALL render normally

#### Scenario: Unauthorized user receives 403

- **WHEN** a user without `activity:view` permission visits `/app/actividad`
- **THEN** they SHALL receive a 403 Forbidden response

### Requirement: User can view inactive clients

The system SHALL display a table of clients who have not made a purchase within a configurable period, including those who have never purchased.

#### Scenario: Table shows inactive clients by selected period

- **WHEN** an admin selects "30 days" from the period dropdown
- **THEN** the table SHALL show clients whose last invoice is more than 30 days ago

#### Scenario: Table shows clients with no purchases

- **WHEN** an admin selects "No purchases" from the period dropdown
- **THEN** the table SHALL show clients who have zero invoices

#### Scenario: Period dropdown provides all options

- **WHEN** an admin opens the period dropdown
- **THEN** they SHALL see the options: 30 days, 60 days, 90 days, No purchases

#### Scenario: Table updates when period changes

- **WHEN** an admin changes the period dropdown
- **THEN** the table SHALL update immediately to reflect the new filter

#### Scenario: Table columns

- **WHEN** the inactive clients table is displayed
- **THEN** it SHALL include columns: Client Name, Phone, Location, Last Invoice Date
- **AND** rows SHALL be ordered by last invoice date ascending (oldest first, clients with no purchases first)

#### Scenario: No inactive clients found

- **WHEN** all clients have made a purchase within the selected period
- **THEN** the table SHALL display "All clients are active" message

### Requirement: User can view reminders

The system SHALL display a card (`RemindersCard` `components/activity/reminders-card.tsx`) listing all reminders (active and completed), with completed reminders listed last and active reminders ordered with expired dates first, then by nearest date. The card SHALL take no props and SHALL read reminders through `useActivityState()` `stores/use-activity-state.ts` — the store's single state hook — rather than importing `useActivityStore` `stores/activity-store.ts` directly — a store scoped to the whole activity page by `ActivityProvider` `components/activity/activity-provider.tsx`, which also holds one activity list per expanded inactive-client row. The provider is seeded from `getReminders` `lib/actions/reminders.ts`, which returns all reminders as `Reminder[]` sorted completed-last, and is mounted by `app/app/actividad/page.tsx`, so the store is built once per page visit and the card itself contains no store-creation logic. Completing a reminder is optimistic (`activityReducer` `stores/activity-reducer.ts` `completeReminder` patches `{ completed: true }`) and SHALL keep the reminder in the list.

#### Scenario: Reminders show client name, description, and date

- **WHEN** an authorized user visits the activity page
- **THEN** they see an "Active Reminders" card
- **AND** each reminder SHALL show the client name, description, and date

#### Scenario: Expired reminders appear first

- **WHEN** there are active reminders with dates before today
- **THEN** they SHALL appear at the top of the list
- **AND** non-expired reminders SHALL appear after, ordered by remind-at date ascending

#### Scenario: Completed reminders appear last

- **WHEN** a reminder has been marked as completed
- **THEN** it SHALL be listed after all active reminders with done styling (muted row, check icon, struck-through description)

#### Scenario: Overdue reminders are visually distinguished

- **WHEN** a reminder's date is before today
- **THEN** it SHALL be visually highlighted as overdue (destructive bell icon and date)

#### Scenario: Client name links to client profile

- **WHEN** a user clicks a client name in the reminders list
- **THEN** they SHALL be taken to that client's detail page

#### Scenario: Double-click opens edit reminder dialog

- **WHEN** a user double-clicks anywhere on a reminder row
- **THEN** the edit reminder dialog SHALL open pre-filled with that reminder's data

#### Scenario: User can mark a reminder as done

- **WHEN** a user clicks the check button on an active reminder row
- **THEN** the reminder SHALL be marked as completed optimistically
- **AND** the reminder SHALL remain in the list, moved below the active reminders with done styling
- **AND** completed reminders SHALL NOT show a check button
- **AND** a success toast SHALL be displayed

#### Scenario: Empty state shows no reminders message

- **WHEN** there are no reminders
- **THEN** the card SHALL display a "no reminders" message

### Requirement: Reminder dialogs are store-agnostic and the parent owns the mutation

`ReminderDialog` `components/clients/reminder-dialog.tsx` SHALL contain no store logic and SHALL import no store module. It SHALL accept a required `onSubmit(data, editingId?)` prop and SHALL rely on the caller to perform the mutation, the optimistic write, and the resulting toast. The dialog SHALL accept either reminder shape as `reminder` (`ClientReminder` from the client timeline, or `Reminder` from the activity list) because it is used from both routes.

Each call site SHALL select the handler matching the store live on its own route: the client detail page renders the timeline, and the activity page renders the reminders list and the expanded activity lists. `AddReminderButton` `components/clients/add-reminder-button.tsx`, `ReminderItem` `components/clients/reminder-item.tsx`, `LogActivityButton` `components/clients/log-activity-button.tsx`, and `ActivityItem` SHALL use `useTimelineActions` `stores/use-timeline-actions.ts` (requires `TimelineProvider`), while `RemindersCard` `components/activity/reminders-card.tsx` and `ClientActivityRow` `components/activity/client-activity-row.tsx` SHALL use `useActivityActions` `stores/use-activity-actions.ts` (requires `ActivityProvider`); its rows SHALL come from `ActivityPageEntry` `components/activity/activity-page-entry.tsx`, which reads no store. Each hook SHALL own every write to its own store AND the toasts for it, so no component builds its own `run()` call or calls `toast` directly: `useActivityActions` returns `loadActivities`/`createReminder`/`updateReminder`/`createActivity`/`updateActivity`/`completeReminder`/`deleteReminder`, and `useTimelineActions` returns `createInvoice`/`updateInvoice`/`createReminder`/`updateReminder`/`createActivity`/`updateActivity`/`completeReminder`/`deleteReminder`/`deleteActivity`/`updatePayment`/`deletePayment`. Because the hooks own the toasts, `createReminder`/`updateReminder`/`createActivity`/`updateActivity` and their siblings SHALL stay uniform across routes: a create from the activity page and a create from the timeline SHALL read the same success message, and likewise for updates. `LogActivityDialog` `components/clients/log-activity-dialog.tsx` and `ReminderDialog` `components/clients/reminder-dialog.tsx` SHALL be store-free and take `onSubmit`, because each is rendered under two different providers and cannot know which store to write to. A reminder created from an expanded row SHALL be written to BOTH the card's list and that row's activity list in a single action, since one store holds both; a logged activity SHALL land only in that row's activity list, because the card lists reminders and not activities.

#### Scenario: Creating a reminder on the activity page appears immediately

- **WHEN** a user creates a reminder from the activity page
- **THEN** a temp row SHALL appear in the reminders card before the server responds
- **AND** on success the temp row SHALL be replaced by the saved row, so later complete or delete actions target the real id
- **AND** on failure the temp row SHALL be discarded

#### Scenario: Creating a reminder on the client page uses the timeline

- **WHEN** a user creates a reminder from a client detail page
- **THEN** the temp entry SHALL appear in the client timeline before the server responds
- **AND** on success the entry SHALL be patched with the row returned by `upsertReminder` `lib/actions/reminders.ts`

#### Scenario: Reminder card does not crash without a timeline store

- **WHEN** the activity page renders its reminder dialogs
- **THEN** no timeline store SHALL be required, because the dialog performs no store access itself

### Requirement: User can edit clients from inactive clients card

The system SHALL allow users to edit client details directly from the inactive clients table.

#### Scenario: Edit button on each row

- **WHEN** the inactive clients table is displayed
- **THEN** each row SHALL have an edit button (pencil icon)

#### Scenario: Edit opens client dialog

- **WHEN** a user clicks the edit button on an inactive client row
- **THEN** the ClientDialog opens pre-filled with that client's data

#### Scenario: Edit updates client optimistically

- **WHEN** a user saves changes in the edit dialog
- **THEN** the client's row updates immediately with the new values
- **AND** the dialog closes
- **AND** the server action runs in the background

### Requirement: User can view a client's recent activities inline

The system SHALL allow users to expand an inactive client row in the inactive clients table and view that client's merged timeline (activities and non-completed reminders) without navigating away from the activity page.

#### Scenario: Double-click expands a row with the latest timeline entries

- **WHEN** a user double-clicks an inactive client row
- **THEN** the row expands inline
- **AND** it loads and displays that client's 5 most recent timeline entries (activities and non-completed reminders), ordered newest first

#### Scenario: Expanded activity list shows both activities and reminders

- **WHEN** an expanded inactive client has logged activities and active reminders
- **THEN** the activity list SHALL show the activities alongside the pending reminder entries in a single merged list

#### Scenario: Double-click again collapses the row

- **WHEN** a user double-clicks an expanded inactive client row
- **THEN** the expanded activity list closes

#### Scenario: Chevron arrow toggles the row

- **WHEN** a user clicks the chevron arrow on an inactive client row
- **THEN** the row expands (or collapses if already expanded)
- **AND** the chevron rotates to indicate the expanded state

#### Scenario: App loading indicator shown during activity fetch

- **WHEN** a user expands a row and the client's activities are being fetched
- **THEN** the app loading indicator SHALL be shown at the top of the viewport
- **AND** it SHALL disappear once the fetch completes

#### Scenario: Expanded activity list shows a loading state

- **WHEN** a user expands a row and activities are still loading
- **THEN** the activity list SHALL display a loading indicator

#### Scenario: Client with no activities shows empty state

- **WHEN** an expanded client has no registered activities
- **THEN** the activity list SHALL display a "no activities" message
- **AND** no "Load more" button SHALL be shown

#### Scenario: Load more fetches the next 5 activities

- **WHEN** a user clicks the "Load more" button in an expanded row that has more activities
- **THEN** the next 5 older activities SHALL be appended to the displayed list

#### Scenario: Load more is hidden when no more activities exist

- **WHEN** the expanded row has loaded all of a client's activities
- **THEN** the "Load more" button SHALL be hidden

#### Scenario: Existing row actions remain functional

- **WHEN** a user uses the edit, log activity, or add reminder action on an inactive client row
- **THEN** the action SHALL still work and SHALL NOT collapse the expanded list

#### Scenario: Expanded activity list refreshes after logging an activity

- **WHEN** a user logs a new activity for a client whose row is expanded
- **THEN** the new activity SHALL be prepended to the expanded list optimistically
- **AND** the activity list SHALL NOT re-fetch on submission
- **AND** on success the optimistic entry SHALL be replaced with the persisted activity
- **AND** on failure the optimistic entry SHALL be removed
- **AND** the client's activity count SHALL update immediately

#### Scenario: Optimistic reminder appears immediately in the expanded list

- **WHEN** a user adds a reminder for a client whose row is expanded
- **THEN** the new reminder SHALL be prepended to the expanded list immediately
- **AND** on failure the optimistic entry SHALL be removed

### Requirement: User can see inactive client count and period filter

The inactive clients card SHALL display the number of inactive clients found and provide a labeled period selector within the card content, laid out like the sales invoice table.

#### Scenario: Card shows result count

- **WHEN** the inactive clients card is displayed
- **THEN** a result count aligned to the left SHALL be shown above the table
- **AND** it SHALL reflect the number of clients in the current result set

#### Scenario: Period selector is labeled and right-aligned

- **WHEN** the inactive clients card is displayed
- **THEN** the period selector SHALL have a "Period" label
- **AND** it SHALL be aligned to the right within the card content

#### Scenario: Card shows each client's activity count

- **WHEN** the inactive clients table is displayed
- **THEN** each row SHALL show the total number of activities registered for that client

### Requirement: Per-client activity lists live in the activity-page store

The expanded rows' timelines SHALL be held in `activity-store.ts` as `activities: Record<clientId, ClientActivityList>`, keyed by client, each list carrying `entries`, `hasMore`, and `loaded`. The row component SHALL NOT hold `entries`, `hasMore`, or `loaded` in React state, because a reminder written from an expanded row has to reach both the card's list and that row's activity list, and one store is what makes that a single write. `ClientActivityRow` SHALL read its list via `getClientActivities(clientId)` from `useActivityState()` `stores/use-activity-state.ts`, which supplies `EMPTY_ACTIVITIES` when the client has never been expanded, and SHALL render only the keys it actually uses, so an expanded row re-renders without disturbing its siblings.

#### Scenario: An unexpanded row reads a stable empty list

- **WHEN** `getClientActivities(clientId)` is called for a client that has never been expanded
- **THEN** it SHALL return a shared empty list constant rather than a freshly built object
- **AND** the constant SHALL be the same reference on every call, because a new object each call would loop `useSyncExternalStore`

#### Scenario: Expanding a row fetches once and marks the list loaded

- **WHEN** a user expands a row whose activity list is not `loaded`
- **THEN** `loadActivities(clientId)` SHALL fetch the first page and store it with `loaded: true`
- **AND** the loading state SHALL NOT be published before the fetch resolves, so the row cannot flash an empty list

#### Scenario: Collapsing and re-expanding does not refetch

- **WHEN** a user collapses a loaded list and expands it again
- **THEN** the already-loaded entries SHALL be shown without another fetch

#### Scenario: Load more appends to the existing list

- **WHEN** `loadActivities(clientId, nextCursor)` is called for a list that already has a page
- **THEN** the new entries SHALL be appended after the existing ones rather than replacing them
- **AND** `hasMore` SHALL be updated from the response

### Requirement: Paginated client timeline fetch

The system SHALL provide a paginated server action to retrieve a client's merged timeline (activities and non-completed reminders) for the inline activity list.

#### Scenario: Action returns a page of entries and hasMore flag

- **WHEN** a server action fetches a page of timeline entries for a client
- **THEN** it SHALL return the requested entries ordered newest first
- **AND** entries with the same date SHALL be ordered deterministically (created-at desc, then id)
- **AND** a `hasMore` flag SHALL indicate whether additional older entries exist

#### Scenario: Unauthorized request is rejected

- **WHEN** a user without `client-activity:view` permission calls the paginated fetch
- **THEN** the action SHALL return an empty result set
