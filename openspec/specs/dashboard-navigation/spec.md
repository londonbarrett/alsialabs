## MODIFIED Requirements

### Requirement: Role-based sidebar sections
The sidebar SHALL organize nav items into three sections based on role and permissions: Admin (permission-gated), Navigation (everyone), and Auxiliary (everyone).

**MODIFICATION**: Previously all items were in a flat "Navigation" section. They are now split into Admin (for system-management items like Users, Permissions, Clients, Products, Categories, Contractors, Sales, Reports), Navigation (for user-facing items like Profile and Projects), and Auxiliary (Help, Support).

#### Scenario: Admin section filtered by permissions
- **GIVEN** a user with only `categories:view` permission
- **WHEN** the sidebar renders
- **THEN** the Admin section shows only "Categories"
- **AND** items without matching permissions are hidden

#### Scenario: Super user sees full Admin section
- **GIVEN** a super user
- **WHEN** the sidebar renders
- **THEN** the Admin section shows Users, Permissions, Clients, Products, Categories, Contractors, Sales, and Reports

#### Scenario: Contractors link in admin section
- **GIVEN** a user with `contractors:view` permission
- **WHEN** the sidebar renders
- **THEN** the "Contractors" link is visible in the Admin section with a Wrench icon
- **AND** clicking it navigates to `/dashboard/contractors`

## ADDED Requirements

### Requirement: Dashboard sidebar
The system shall display a sidebar on the dashboard with three areas: user menu, main navigation, and auxiliary menu.

#### Scenario: View sidebar
- **WHEN** the dashboard is loaded
- **THEN** the sidebar displays three areas: user menu, main navigation, auxiliary menu

### Requirement: Menu item navigation
The system shall highlight menu items when clicked and stay on the home route.

#### Scenario: Click menu item
- **WHEN** menu items are displayed
- **WHEN** the user clicks any menu item
- **THEN** the item is highlighted as active
- **THEN** the user stays on the home route

### Requirement: Collapse sidebar
The system shall allow the user to collapse the sidebar to icons-only.

#### Scenario: Collapse sidebar
- **WHEN** the sidebar is expanded
- **WHEN** the user clicks the collapse toggle
- **THEN** the sidebar collapses to icons-only

### Requirement: Menu data source
Menu items shall be loaded from a config JSON object.

### Requirement: Icons on menu items
All menu items shall display an icon.

### Requirement: Responsive sidebar
The sidebar shall adapt its layout on mobile viewports.

### Requirement: Keyboard navigation
The sidebar shall be fully keyboard navigable.

### Requirement: Sidebar filtered by permissions
The system SHALL filter sidebar navigation items based on the user's module permissions. Items for modules the user cannot view SHALL be hidden.

#### Scenario: Menu items filtered by permission
- **GIVEN** a user has permission to view some modules but not others
- **WHEN** the sidebar renders
- **THEN** only nav items for permitted modules are visible

### Requirement: Menu data source extended for permissions
The sidebar menu config SHALL include permission requirements per item.

#### Scenario: Menu config includes required permission
- **WHEN** the sidebar menu config is loaded
- **THEN** each nav item optionally specifies a required permission (e.g., "clients:view")

### Requirement: Profile nav item
The sidebar SHALL include a Profile item in the Navigation section that links to `/dashboard/profile`.

#### Scenario: Profile link visible
- **WHEN** the sidebar renders
- **THEN** a Profile nav item appears in the Navigation section
- **AND** it requires no permission to see

### Requirement: Category admin page permission gate
The admin categories page SHALL require `categories:view` permission to access. Clients SHALL read categories via a separate unauthenticated server action for operational purposes.

#### Scenario: Category page restricted to admins
- **GIVEN** a user without `categories:view` permission
- **WHEN** the user navigates to `/dashboard/categories`
- **THEN** a forbidden error is returned
