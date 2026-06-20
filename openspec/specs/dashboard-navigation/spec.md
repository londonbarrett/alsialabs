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
