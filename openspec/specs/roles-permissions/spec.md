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

### Requirement: Client permissions are seeded and manageable
The system SHALL include client module permissions that can be toggled for each role in the permission matrix.

#### Scenario: Client permissions exist after seeding
- **WHEN** the database seed script runs
- **THEN** `clients:view`, `clients:create`, `clients:edit`, `clients:delete`, `clients:invite` permissions are created
- **AND** the super role has all client permissions enabled
- **AND** the admin role has `clients:view`, `clients:create`, `clients:edit`, `clients:invite` enabled
- **AND** the admin role does NOT have `clients:delete` enabled
- **AND** the client role has no client permissions

## ADDED Requirements

### Requirement: Contractors permissions are seeded and manageable
The system SHALL include contractors module permissions that can be toggled for each role in the permission matrix.

#### Scenario: Contractors permissions exist after seeding
- **WHEN** the database seed script runs
- **THEN** `contractors:view`, `contractors:create`, `contractors:edit`, `contractors:delete` permissions are created
- **AND** the super role has all contractors permissions enabled
- **AND** the admin role has `contractors:view`, `contractors:create`, `contractors:edit` enabled
- **AND** the admin role does NOT have `contractors:delete` enabled
- **AND** the client role has no contractors permissions

#### Scenario: Super can toggle contractors permissions
- **WHEN** a super user visits the permissions page
- **THEN** the contractors module appears in the permission matrix with view, create, edit, delete actions
- **AND** each action is toggleable per role

### Requirement: Super manages permission modules
The system SHALL allow super users to manage modules (add/edit/delete) with associated actions on the permissions page.

#### Scenario: Super creates a module with actions
- **WHEN** a super user adds a new module (e.g., "clients") with actions (e.g., "view", "create", "edit", "delete")
- **THEN** the module appears in the permission matrix
- **AND** each action is toggleable per role

#### Scenario: Super deletes a module
- **WHEN** a super user deletes a module
- **THEN** the module and its permissions are removed from all roles

### Requirement: Super toggles permissions per role
The system SHALL allow super users to enable or disable specific module/action permissions for any role.

#### Scenario: Super disables a permission for a role
- **WHEN** a super user toggles a permission off for a role
- **THEN** that role loses the associated capability
- **AND** users with that role can no longer perform the action
- **AND** the UI reflects the restriction

#### Scenario: Super enables a permission for a role
- **WHEN** a super user toggles a permission on for a role
- **THEN** that role gains the associated capability
- **AND** users with that role can perform the action

### Requirement: UI hides unauthorized actions
The system SHALL hide UI controls for actions the user does not have permission to perform.

#### Scenario: Admin sees clients page without delete button
- **GIVEN** an admin user has no `clients:delete` permission
- **WHEN** viewing the clients page
- **THEN** the delete/trash button is not visible on any client row

#### Scenario: Super sees all client actions
- **GIVEN** a super user has all permissions
- **WHEN** viewing the clients page
- **THEN** all action buttons (view, edit, delete) are visible

### Requirement: Server action enforces permission
The system SHALL check the caller's permission in every server action that modifies data.

#### Scenario: Unauthorized server action is rejected
- **GIVEN** a user without `clients:delete` permission
- **WHEN** they call the `deleteClient` server action
- **THEN** the action returns an error
- **AND** the client is not deleted

### Requirement: Sidebar filters by permission
The system SHALL hide sidebar navigation items for modules the user does not have view permission for.

#### Scenario: Sidebar hides clients for user without clients:view
- **GIVEN** a user has no `clients:view` permission
- **WHEN** viewing the sidebar
- **THEN** the Clients link is not visible

#### Scenario: Sidebar shows Clients for user with clients:view
- **GIVEN** a user has `clients:view` permission
- **WHEN** viewing the sidebar
- **THEN** the Clients link is visible

### Requirement: Non-super cannot access permissions page
The system SHALL restrict `/dashboard/permissions` to super users only.

#### Scenario: Admin is forbidden from permissions page
- **WHEN** an admin user navigates to `/dashboard/permissions`
- **THEN** they see a 403 forbidden page

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

### Requirement: Delete button hidden without clients:delete
The system SHALL hide the delete action for clients when the user does not have `clients:delete` permission.

#### Scenario: Delete button hidden without clients:delete
- **GIVEN** a user lacks `clients:delete` permission
- **WHEN** viewing a client row
- **THEN** the delete action is not visible in the action menu

#### Scenario: View button visible with sales:view-invoice-history
- **GIVEN** a user has `sales:view-invoice-history` permission
- **WHEN** viewing a client row
- **THEN** the "View" action is visible in the action menu
