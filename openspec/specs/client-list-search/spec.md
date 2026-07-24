## ADDED Requirements

### Requirement: Client list search input
The system SHALL display a search input on the client list page that filters the displayed clients.

#### Scenario: Search input is visible
- **WHEN** the user visits `/dashboard/clients`
- **AND** there are clients in the database
- **THEN** a search input field is displayed above or beside the client table
- **AND** the input has a search icon and placeholder text indicating it searches clients

#### Scenario: Typing filters the table
- **WHEN** the user types a search query into the search input
- **THEN** the table rows are filtered to show only clients matching the query
- **AND** filtering is case-insensitive
- **AND** filtering matches against name, phone, email, location, and comments fields

#### Scenario: No results match
- **WHEN** the user types a query that matches no clients
- **THEN** the table is replaced with a message indicating no clients match the search

#### Scenario: Clearing the search
- **WHEN** the user clears the search input
- **THEN** all clients are displayed again

### Requirement: Search is accessible
The search input SHALL be accessible with proper labeling and keyboard support.

#### Scenario: Search input has accessible label
- **WHEN** the search input is rendered
- **THEN** it has an associated label or aria-label for screen readers

#### Scenario: Keyboard navigation
- **WHEN** a user focuses the search input
- **THEN** they can type to search without any keyboard conflicts
