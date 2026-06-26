## MODIFIED Requirements

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
