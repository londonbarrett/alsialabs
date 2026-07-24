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
