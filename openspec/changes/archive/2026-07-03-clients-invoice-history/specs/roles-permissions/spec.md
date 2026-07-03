## ADDED Requirements

### Requirement: sales:view-invoice-history is seeded for client and admin roles
The system SHALL include `sales:view-invoice-history` in the database seed for both client and admin roles.

#### Scenario: sales:view-invoice-history exists after seeding
- **WHEN** the database seed script runs
- **THEN** a `sales:view-invoice-history` permission is created in the permissions table
- **AND** the permission is enabled for the admin role
- **AND** the permission is enabled for the client role

### Requirement: sales:view-invoice-history appears in permission matrix
The system SHALL show `sales:view-invoice-history` as a toggleable permission under the sales module in the permission matrix for super users.

#### Scenario: Super can toggle sales:view-invoice-history
- **WHEN** a super user visits the permissions page
- **THEN** the sales module shows a `view-invoice-history` action in the permission matrix
- **AND** it is toggleable per role

### Requirement: Client permissions are seeded and manageable
The system SHALL include client module permissions that can be toggled for each role in the permission matrix.

#### Scenario: Client permissions exist after seeding
- **WHEN** the database seed script runs
- **THEN** `clients:view`, `clients:create`, `clients:edit`, `clients:delete`, `clients:invite` permissions are created
- **AND** the super role has all client permissions enabled
- **AND** the admin role has `clients:view`, `clients:create`, `clients:edit`, `clients:invite` enabled
- **AND** the admin role does NOT have `clients:delete` enabled
- **AND** the client role has no client permissions

#### Scenario: Delete button hidden without clients:delete
- **GIVEN** a user lacks `clients:delete` permission
- **WHEN** viewing a client row
- **THEN** the delete action is not visible in the action menu

#### Scenario: View button visible with sales:view-invoice-history
- **GIVEN** a user has `sales:view-invoice-history` permission
- **WHEN** viewing a client row
- **THEN** the "View" action is visible in the action menu

## MODIFIED Requirements

### Requirement: Sales permissions are seeded and manageable
The system SHALL include sales module permissions that can be toggled for each role in the permission matrix.

#### Scenario: Sales permissions exist after seeding
- **WHEN** the database seed script runs
- **THEN** `sales:view`, `sales:create`, `sales:edit`, `sales:delete`, `sales:view-invoice-history` permissions are created
- **AND** the super role has all five sales permissions enabled
- **AND** the admin role has `sales:view`, `sales:create`, `sales:edit`, `sales:view-invoice-history` enabled
- **AND** the admin role does NOT have `sales:delete` enabled
- **AND** the client role has `sales:view-invoice-history` enabled only

#### Scenario: Super can toggle sales permissions
- **WHEN** a super user visits the permissions page
- **THEN** the sales module appears in the permission matrix with view, create, edit, delete, view-invoice-history actions
- **AND** each action is toggleable per role
