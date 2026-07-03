## Requirements
### Requirement: User can create a new client
The system SHALL allow authenticated users to create a new client via a dialog form.

#### Scenario: Successful client creation
- **WHEN** the user clicks "New Client" button next to "Import Data"
- **THEN** a dialog form appears with fields: name, phone, location, comments, email
- **WHEN** the user fills in valid data and submits
- **THEN** the form validates on the client side
- **AND** the server action is called with the data
- **AND** the submit button shows a spinner and is disabled while the request is in flight
- **AND** on success the dialog closes
- **AND** the clients table updates with the new client

### Requirement: User can edit an existing client
The system SHALL allow authenticated users to edit an existing client via the same dialog form, pre-filled with the client's current data.

#### Scenario: Successful client edit
- **WHEN** the user clicks the Edit action in a client's row dropdown menu
- **THEN** a dialog form appears pre-filled with that client's data
- **WHEN** the user modifies the data and submits
- **THEN** the form validates on the client side
- **AND** the server action is called with the updated data
- **AND** the submit button shows a spinner and is disabled while the request is in flight
- **AND** on success the dialog closes
- **AND** the clients table reflects the updated data

### Requirement: Form validation catches invalid data
The system SHALL validate form input on the client before submitting to the server, and display inline error messages for invalid fields.

#### Scenario: Invalid data submission is blocked
- **WHEN** the user submits the form with invalid or missing required fields
- **THEN** the form highlights the invalid fields with error messages
- **AND** the server action is not called

### Requirement: Duplicate phone numbers are rejected
The system SHALL prevent creating or updating a client with a phone number that already exists in the database.

#### Scenario: Duplicate phone detected
- **WHEN** the user enters a phone number that already exists in the database
- **THEN** the form shows a validation error for the phone field
- **AND** the submission is blocked

### Requirement: Server actions require authentication
The system SHALL reject unauthenticated requests to create or update clients.

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated user attempts to call the server action
- **THEN** the action returns an unauthorized error
- **AND** no data is modified

### Requirement: Server-side validation and sanitization
The system SHALL validate and sanitize all input on the server, even if client-side validation passed.

#### Scenario: Malicious or malformed data is rejected server-side
- **WHEN** the server receives malformed or malicious input
- **THEN** the server rejects the data with a validation error
- **AND** no data is modified

### Requirement: Dialog is accessible
The dialog and form SHALL be keyboard-navigable and screen-reader friendly.

#### Scenario: Keyboard navigation works
- **WHEN** the dialog is open
- **THEN** focus is trapped within the dialog
- **AND** the Escape key closes the dialog
- **AND** Tab navigates through form fields in logical order

#### Scenario: Screen reader announces dialog purpose
- **WHEN** the dialog opens
- **THEN** screen readers announce the dialog title ("New Client" or "Edit Client")
- **AND** all form fields have associated labels

### Requirement: Reusable form component
The form component SHALL be a reusable component that can be used outside the dialog context.

#### Scenario: Form works as standalone component
- **WHEN** the form is rendered outside a dialog
- **THEN** it renders all fields correctly
- **AND** accepts an optional `client` prop for edit mode
- **AND** accepts an `onSubmit` callback for custom submission handling

### Requirement: Invite action in client row menu
The system SHALL show an "Invite" action in the client row action menu for users with `clients:invite` permission.

#### Scenario: Invite action visible with permission
- **WHEN** the admin opens the actions menu for a client
- **AND** the admin has `clients:invite` permission
- **THEN** an "Invite" action is shown in the menu

#### Scenario: Invite action hidden without permission
- **WHEN** the admin opens the actions menu for a client
- **AND** the admin lacks `clients:invite` permission
- **THEN** the "Invite" action is not shown

### Requirement: Email sync between client and linked user
The system SHALL update the linked user's email when the client's email is changed via the edit form.

#### Scenario: Client email update syncs to user
- **GIVEN** the client has a linked user account
- **WHEN** the admin edits the client and changes the email
- **THEN** the `users.email` field is updated to match the new `clients.email`

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

