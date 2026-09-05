## ADDED Requirements

### Requirement: My Invoices sidebar item
The sidebar SHALL include a "My Invoices" item in the Navigation section that links to `/dashboard/my-invoices`. It SHALL appear above My Tasks, use the Receipt icon, and require no permission to see. It SHALL be highlighted as active when the pathname is `/dashboard/my-invoices` or a subroute thereof.

#### Scenario: My Invoices link visible
- **WHEN** the sidebar renders for any authenticated user
- **THEN** a "My Invoices" nav item appears in the Navigation section above "My Tasks"
- **AND** it uses the Receipt icon
- **AND** it requires no permission to see

#### Scenario: My Invoices navigates to my-invoices page
- **WHEN** the user clicks "My Invoices" in the sidebar
- **THEN** the user is navigated to `/dashboard/my-invoices`

#### Scenario: My Invoices stays active on subroute
- **GIVEN** the user is on `/dashboard/my-invoices/123`
- **WHEN** the sidebar renders
- **THEN** the "My Invoices" nav item is highlighted as active

#### Scenario: My Invoices visible in Navigation section ordering
- **WHEN** the sidebar renders
- **THEN** the Navigation section order is Profile, My Invoices, My Tasks, Projects, Calendar (with permission-gated items filtered), above Auxiliary
