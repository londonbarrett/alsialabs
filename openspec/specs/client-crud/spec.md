## MODIFIED Requirements

### Requirement: Invoice history section on client profile
The system SHALL display an invoice history section on the client profile page, showing all invoices belonging to the client.

**MODIFICATION**: The invoice history section now appears below the Activity section instead of directly below client info.

#### Scenario: Invoice history section is visible
- **GIVEN** a user with `sales:view-invoice-history` permission is viewing a client's profile
- **THEN** an invoice history section appears below the client's profile information
- **AND** the section header reads "Invoice History"

### Requirement: Activity section on client profile
**ADDED**: The system SHALL display an Activity section on the client profile page showing the activity timeline.

#### Scenario: Activity section is visible
- **GIVEN** a user with `activities:view` permission is viewing a client's profile
- **THEN** an Activity section appears below the client's profile information
- **AND** the section header reads "Activity"
- **AND** the timeline shows both activities and reminders sorted by date descending

### Requirement: Client switcher on profile page
**ADDED**: The system SHALL provide a client switcher at the top of the client profile page, allowing users to navigate between client profiles without returning to the client list.

#### Scenario: Switcher shows current client name
- **WHEN** the user is on a client profile page
- **THEN** a combobox at the top shows the current client's name

#### Scenario: User navigates to another client
- **WHEN** the user selects a different client from the switcher
- **THEN** the page navigates to that client's profile
- **AND** the combobox is disabled during navigation
- **AND** the input cannot receive focus or accept typing while disabled

#### Scenario: Users can search clients in the switcher
- **WHEN** the user types in the switcher input
- **THEN** the dropdown filters to show matching clients
