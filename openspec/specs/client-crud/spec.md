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
**MODIFIED**: The system SHALL provide a client switcher at the top of the client profile page, allowing users to navigate between client profiles without returning to the client list. The switcher starts empty (no pre-selected value).

#### Scenario: Switcher starts empty
- **WHEN** the user is on a client profile page
- **THEN** the combobox input is empty with a placeholder text

#### Scenario: User navigates to another client
- **WHEN** the user selects a different client from the switcher
- **THEN** the page navigates to that client's profile
- **AND** the combobox is disabled during navigation

#### Scenario: Users can search clients in the switcher
- **WHEN** the user types in the switcher input
- **THEN** the dropdown filters to show matching clients

#### Scenario: User can clear the selection
- **WHEN** a client is selected and the user clicks the clear button
- **THEN** the combobox input becomes empty

## ADDED Requirements

### Requirement: Client detail page header
The system SHALL display a PageHeader on the client profile page with the client's name as the title, a Users icon, and the client switcher in the actions area.

#### Scenario: PageHeader displays client name
- **WHEN** the user views a client profile
- **THEN** the page header shows the client's name as the title
- **AND** a Users icon is displayed next to the title

#### Scenario: Client switcher in header actions
- **WHEN** the client profile page is rendered
- **THEN** the client switcher combobox appears in the header actions area

### Requirement: Client info card
The system SHALL display client details in a Card component with an edit button.

#### Scenario: Client info displayed in Card
- **WHEN** the user views a client profile
- **THEN** client details (name, phone, email, location, comments) are shown in a Card component
- **AND** the card has a "Details" header with an edit button (pencil icon)

#### Scenario: Edit button opens dialog
- **WHEN** the user clicks the edit button on the client info card
- **THEN** the ClientDialog opens pre-filled with the current client data

#### Scenario: Edit updates client optimistically
- **WHEN** the user saves changes in the edit dialog
- **THEN** the client info card updates immediately with the new values
- **AND** the dialog closes
- **AND** the server action runs in the background
- **AND** a global loading indicator shows during the save

### Requirement: Client list edit updates optimistically
The system SHALL update the client list immediately when a client is edited, without refreshing the page.

#### Scenario: Edit updates client in list
- **WHEN** a user edits a client from the clients list
- **THEN** the client's row updates immediately with the new values
- **AND** the dialog closes
- **AND** the server action runs in the background

#### Scenario: Create still refreshes
- **WHEN** a user creates a new client from the clients list
- **THEN** the page refreshes to show the new client with its server-generated ID
