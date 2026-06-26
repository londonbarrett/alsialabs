## ADDED Requirements

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
