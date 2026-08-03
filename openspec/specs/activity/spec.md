## MODIFIED Requirements

### Requirement: Access control
The activity page SHALL only be accessible to users with the `activity:view` permission.

#### Scenario: User with permission can access activity
- **WHEN** a user with `activity:view` permission visits `/dashboard/activity`
- **THEN** the activity page SHALL render normally

#### Scenario: Unauthorized user receives 403
- **WHEN** a user without `activity:view` permission visits `/dashboard/activity`
- **THEN** they SHALL receive a 403 Forbidden response

## ADDED Requirements

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

### Requirement: User can view active future reminders
The system SHALL display a card listing all non-completed reminders, ordered with expired reminders first, then by nearest date.

#### Scenario: Reminders show client name, description, and date
- **WHEN** an authorized user visits the activity page
- **THEN** they see an "Active Reminders" card
- **AND** each reminder SHALL show the client name, description, and date

#### Scenario: Expired reminders appear first
- **WHEN** there are active reminders with dates before today
- **THEN** they SHALL appear at the top of the list
- **AND** non-expired reminders SHALL appear after, ordered by remind-at date ascending

#### Scenario: Overdue reminders are visually distinguished
- **WHEN** a reminder's date is before today
- **THEN** it SHALL be visually highlighted as overdue

#### Scenario: Client name links to client profile
- **WHEN** a user clicks a client name in the reminders list
- **THEN** they SHALL be taken to that client's detail page

#### Scenario: Double-click opens edit reminder dialog
- **WHEN** a user double-clicks anywhere on a reminder row
- **THEN** the edit reminder dialog SHALL open pre-filled with that reminder's data

#### Scenario: User can mark a reminder as done
- **WHEN** a user clicks the check button on a reminder row
- **THEN** the reminder SHALL be marked as completed
- **AND** the reminder SHALL be removed from the active reminders list
- **AND** a success toast SHALL be displayed

#### Scenario: Empty state shows no reminders message
- **WHEN** there are no active reminders
- **THEN** the card SHALL display "No active reminders" message

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
The system SHALL allow users to expand an inactive client row in the inactive clients table and view that client's most recent activities without navigating away from the activity page.

#### Scenario: Double-click expands a row with the last 5 activities
- **WHEN** a user double-clicks an inactive client row
- **THEN** the row expands inline
- **AND** it loads and displays that client's 5 most recent activities, ordered newest first

#### Scenario: Double-click again collapses the row
- **WHEN** a user double-clicks an expanded inactive client row
- **THEN** the expanded activity panel closes

#### Scenario: Chevron arrow toggles the row
- **WHEN** a user clicks the chevron arrow on an inactive client row
- **THEN** the row expands (or collapses if already expanded)
- **AND** the chevron rotates to indicate the expanded state

#### Scenario: App loading indicator shown during activity fetch
- **WHEN** a user expands a row and the client's activities are being fetched
- **THEN** the app loading indicator SHALL be shown at the top of the viewport
- **AND** it SHALL disappear once the fetch completes

#### Scenario: Expanded panel shows a loading state
- **WHEN** a user expands a row and activities are still loading
- **THEN** the panel SHALL display a loading indicator

#### Scenario: Client with no activities shows empty state
- **WHEN** an expanded client has no registered activities
- **THEN** the panel SHALL display a "no activities" message
- **AND** no "Load more" button SHALL be shown

#### Scenario: Load more fetches the next 5 activities
- **WHEN** a user clicks the "Load more" button in an expanded row that has more activities
- **THEN** the next 5 older activities SHALL be appended to the displayed list

#### Scenario: Load more is hidden when no more activities exist
- **WHEN** the expanded row has loaded all of a client's activities
- **THEN** the "Load more" button SHALL be hidden

#### Scenario: Existing row actions remain functional
- **WHEN** a user uses the edit, log activity, or add reminder action on an inactive client row
- **THEN** the action SHALL still work and SHALL NOT toggle the expanded panel

#### Scenario: Expanded panel refreshes after logging an activity
- **WHEN** a user logs a new activity for a client whose row is expanded
- **THEN** the expanded panel SHALL reload the client's most recent 5 activities
- **AND** the newly logged activity SHALL appear in the list

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

### Requirement: Paginated client activity fetch
The system SHALL provide a paginated server action to retrieve a client's activities for the inline panel.

#### Scenario: Action returns a page of activities and hasMore flag
- **WHEN** a server action fetches a page of activities for a client
- **THEN** it SHALL return the requested activities ordered newest first
- **AND** a `hasMore` flag SHALL indicate whether additional older activities exist

#### Scenario: Unauthorized request is rejected
- **WHEN** a user without `client-activity:view` permission calls the paginated fetch
- **THEN** the action SHALL return an empty result set
