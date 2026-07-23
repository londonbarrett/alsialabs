## MODIFIED Requirements

### Requirement: Access control
The reports page SHALL only be accessible to users with the `reports:view` permission.

#### Scenario: User with permission can access reports
- **WHEN** a user with `reports:view` permission visits `/dashboard/reports`
- **THEN** the reports page SHALL render normally

#### Scenario: Unauthorized user receives 403
- **WHEN** a user without `reports:view` permission visits `/dashboard/reports`
- **THEN** they SHALL receive a 403 Forbidden response

## ADDED Requirements

### Requirement: User can view monthly revenue chart
The system SHALL display a stacked bar chart showing monthly revenue split by invoice type (product/service). Revenue SHALL be computed from invoice items, excluding items with `unit_price = 0`. The chart tooltip SHALL display quantity sold alongside revenue for each bar segment.

#### Scenario: Revenue chart shows data grouped by month and type
- **WHEN** an admin with `reports:view` permission visits the reports page
- **THEN** they see a stacked bar chart with months on the x-axis and revenue on the y-axis
- **AND** each month's bar is split into product revenue and service revenue segments

#### Scenario: Revenue chart shows all available data
- **WHEN** there are invoices dating back multiple years
- **THEN** the chart SHALL display every month that has invoice data, ordered chronologically

#### Scenario: Revenue chart shows empty state
- **WHEN** there are no invoices in the system
- **THEN** the chart area SHALL display a placeholder message indicating no data

#### Scenario: Tooltip shows quantity sold alongside revenue
- **WHEN** a user hovers over a bar segment in the monthly revenue chart
- **THEN** the tooltip SHALL display both the revenue amount and the quantity sold for that segment

#### Scenario: Items with zero unit price are excluded
- **WHEN** an invoice item has `unit_price = 0`
- **THEN** that item SHALL NOT be included in the revenue or quantity calculations

### Requirement: User can view top clients by revenue
The system SHALL display a horizontal bar chart ranking the top 10 clients by total invoice amount.

#### Scenario: Top clients chart shows highest revenue clients
- **WHEN** an admin with `reports:view` permission visits the reports page
- **THEN** they see a horizontal bar chart with client names on the y-axis and total revenue on the x-axis
- **AND** clients are ordered from highest to lowest revenue
- **AND** at most 10 clients are shown

#### Scenario: Top clients chart shows empty state
- **WHEN** there are no invoices in the system
- **THEN** the chart area SHALL display a placeholder message indicating no data

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
The system SHALL display a card listing all non-completed reminders whose remind-at date is today or in the future, ordered by nearest date first.

#### Scenario: Reminders show client name, description, and date
- **WHEN** an authorized user visits the reports page
- **THEN** they see an "Active Reminders" card
- **AND** each reminder SHALL show the client name, description, and date

#### Scenario: Reminders are ordered by nearest date first
- **WHEN** there are multiple active reminders
- **THEN** they SHALL be ordered by remind-at date ascending (soonest first)

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
