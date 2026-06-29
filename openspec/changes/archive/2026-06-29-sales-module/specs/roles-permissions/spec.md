## ADDED Requirements

### Requirement: Sales permissions are seeded and manageable
The system SHALL include sales module permissions that can be toggled for each role in the permission matrix.

#### Scenario: Sales permissions exist after seeding
- **WHEN** the database seed script runs
- **THEN** `sales:view`, `sales:create`, `sales:edit`, `sales:delete` permissions are created
- **AND** the super role has all four sales permissions enabled
- **AND** the admin role has `sales:view`, `sales:create`, `sales:edit` enabled
- **AND** the admin role does NOT have `sales:delete` enabled
- **AND** the client role has no sales permissions

#### Scenario: Super can toggle sales permissions
- **WHEN** a super user visits the permissions page
- **THEN** the sales module appears in the permission matrix with view, create, edit, delete actions
- **AND** each action is toggleable per role

#### Scenario: Delete button hidden without sales:delete
- **GIVEN** a user lacks `sales:delete` permission
- **WHEN** viewing an invoice row
- **THEN** the delete action is not visible in the action menu

#### Scenario: New Invoice button hidden without sales:create
- **GIVEN** a user lacks `sales:create` permission
- **WHEN** viewing the sales page
- **THEN** the "New Invoice" button is not visible
