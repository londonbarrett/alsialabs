## ADDED Requirements

### Requirement: Invoice history section on client profile
The system SHALL display an invoice history section on the client profile page, showing all invoices belonging to the client.

#### Scenario: Invoice history section is visible
- **GIVEN** a user with `sales:view-invoice-history` permission is viewing a client's profile
- **THEN** an invoice history section appears below the client's profile information
- **AND** the section header reads "Invoice History"

### Requirement: View action in client row menu
The system SHALL show a "View" action in the client row action menu.

#### Scenario: View action visible to all
- **WHEN** a user opens the actions menu for a client row
- **THEN** a "View" action is shown in the menu

### Requirement: View action navigates to client profile
The system SHALL navigate to `/clients/[clientId]` when the "View" action is clicked.

#### Scenario: Clicking View navigates to client profile
- **GIVEN** a user is on the clients page
- **WHEN** they click the "View" action in a client's row menu
- **THEN** they are navigated to `/clients/[clientId]`

### Requirement: Client profile route accessible without invoice permission
The system SHALL render the client's profile information at `/clients/[clientId]` regardless of `sales:view-invoice-history` permission.

#### Scenario: Profile page shows without invoice permission
- **GIVEN** a user without `sales:view-invoice-history` permission
- **WHEN** navigating to `/clients/[clientId]`
- **THEN** they see the client's profile information
- **AND** the invoice history section is not shown

## MODIFIED Requirements

### Requirement: Server actions require permission
The system SHALL check the caller's permission before executing server actions that access data.

#### Scenario: Fetch invoice history requires sales:view-invoice-history permission
- **WHEN** a user without `sales:view-invoice-history` permission calls the invoice history action
- **THEN** the action returns an error
- **AND** no data is returned

### Requirement: Clients page requires clients:view permission
The system SHALL require `clients:view` permission to access the clients page. Users without it shall be redirected or see a forbidden page.

#### Scenario: No clients:view redirects user
- **GIVEN** a user without `clients:view` permission
- **WHEN** navigating to `/dashboard/clients`
- **THEN** they see a forbidden page

### Requirement: Nav link hidden without permission
The system SHALL hide the Clients nav link when the user lacks `clients:view` permission.

#### Scenario: Clients link hidden from sidebar
- **GIVEN** a user without `clients:view` permission
- **THEN** the Clients link is not shown in the sidebar
