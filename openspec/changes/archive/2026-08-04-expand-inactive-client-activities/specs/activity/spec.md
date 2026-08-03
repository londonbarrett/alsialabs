## ADDED Requirements

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
