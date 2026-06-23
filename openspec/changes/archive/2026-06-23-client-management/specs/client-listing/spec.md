## ADDED Requirements

### Requirement: Clients are displayed in a table
The system SHALL display all imported clients in a ShadCN Table at `/dashboard/clients`.

#### Scenario: Clients exist — table is shown
- **WHEN** the user visits `/dashboard/clients`
- **AND** there are clients in the database
- **THEN** a table is displayed with columns: Name, Phone, Location, Comments, Email
- **AND** each row has a three-dot button in the Actions column
- **WHEN** the three-dot button is clicked
- **THEN** a dropdown menu opens with View (eye icon), Edit (pencil icon), and Delete (trash icon, red text) items

#### Scenario: No clients — empty state is shown
- **WHEN** the user visits `/dashboard/clients`
- **AND** there are no clients in the database
- **THEN** a "No clients yet" message is displayed
- **AND** an "Import data" button is visible

#### Scenario: Action menu items show toast
- **WHEN** the user clicks View, Edit, or Delete from the row's dropdown menu
- **THEN** a toast notification is shown indicating the action

### Requirement: Table must be accessible
The table SHALL be accessible, with proper ARIA labels, keyboard navigation, and semantic markup.

#### Scenario: Table has proper ARIA labels
- **WHEN** the table is rendered
- **THEN** it SHALL have appropriate ARIA labels and roles for screen readers

#### Scenario: Table supports keyboard navigation
- **WHEN** a user navigates the table using keyboard
- **THEN** focus is visibly indicated and all interactive elements are reachable via tab

### Requirement: Client data is fetched on the server
The page SHALL fetch client data on the server (Server Component) using default Next.js behavior.

#### Scenario: Page renders client data from server
- **WHEN** the page is requested
- **THEN** client data is fetched from the database on the server
- **AND** the rendered HTML includes the full client list
