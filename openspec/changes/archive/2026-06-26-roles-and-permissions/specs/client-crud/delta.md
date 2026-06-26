## MODIFIED Requirements

### Requirement: Server actions require permission
The system SHALL check the caller's permission before executing server actions that modify data.

#### Scenario: Delete client requires clients:delete permission
- **WHEN** a user without `clients:delete` permission calls `deleteClient`
- **THEN** the action returns an error
- **AND** the client is not deleted

#### Scenario: Delete button hidden without permission
- **GIVEN** the user lacks `clients:delete` permission
- **WHEN** viewing a client row
- **THEN** the delete/trash action is not visible

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
