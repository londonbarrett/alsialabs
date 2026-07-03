# client-invoice-history Specification

## Purpose
TBD - created by archiving change clients-invoice-history. Update Purpose after archive.
## Requirements
### Requirement: Client can view own invoice history
The system SHALL allow an authenticated client with `sales:view-invoice-history` permission to view a list of their own invoices on their profile page.

#### Scenario: Client views invoice history on profile
- **GIVEN** a client is authenticated with `sales:view-invoice-history` permission
- **WHEN** they navigate to their profile page
- **THEN** they see an invoice history section below their profile information
- **AND** the section lists all invoices belonging to them with columns: invoice number, type, issue date, grand total, status

### Requirement: Admin can view any client's invoice history
The system SHALL allow an authenticated admin with `sales:view-invoice-history` permission to view any client's invoice history.

#### Scenario: Admin navigates to client profile via clients page
- **GIVEN** an admin is authenticated with `sales:view-invoice-history` permission
- **WHEN** they navigate to the clients page
- **AND** they click the "View" button in the actions menu for a client
- **THEN** they are taken to `/clients/[clientId]`
- **AND** they see the client's profile with the invoice history section

### Requirement: Admin can view client profile route
The system SHALL provide a `/clients/[clientId]` route that renders the client's profile with an invoice history section, identical to the profile page layout.

#### Scenario: Client profile route exists
- **GIVEN** a user is authenticated
- **WHEN** they navigate to `/clients/[clientId]`
- **THEN** they see the client's profile information
- **AND** the invoice history section is shown if they have `sales:view-invoice-history` permission

### Requirement: Invoice history hidden without permission
The system SHALL hide the invoice history section on `/clients/[clientId]` and the profile page for users without `sales:view-invoice-history` permission.

#### Scenario: No permission hides invoice history
- **GIVEN** a user authenticated without `sales:view-invoice-history` permission
- **WHEN** they visit a client's profile page
- **THEN** they see the profile information
- **AND** the invoice history section is not shown
- **AND** the invoice history data is not fetched

### Requirement: Invoice history lists all invoices
The system SHALL display all invoices for the client, ordered by issue date (newest first).

#### Scenario: Full invoice list is displayed
- **GIVEN** a user with `sales:view-invoice-history` permission is viewing a client's profile
- **THEN** the invoice history section shows all invoices belonging to that client
- **AND** invoices are sorted by issue date descending

### Requirement: Server action fetches invoice history
The system SHALL provide a server action to fetch a client's invoices, gated by authentication and `sales:view-invoice-history` permission.

#### Scenario: Server action returns invoices for authorized user
- **GIVEN** a user with `sales:view-invoice-history` permission
- **WHEN** they call the invoice history server action for a client
- **THEN** the action returns the client's invoices with line items and totals

#### Scenario: Server action rejects unauthorized user
- **GIVEN** a user without `sales:view-invoice-history` permission
- **WHEN** they call the invoice history server action for a client
- **THEN** the action returns an unauthorized error
- **AND** no invoice data is returned

