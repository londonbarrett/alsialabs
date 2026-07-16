## ADDED Requirements

### Requirement: Contractor profile management
Any user can opt-in to become a contractor by creating a profile with bio, hourly rate, and portfolio links. Admins can manage any contractor profile.

#### Scenario: User creates contractor profile
- **GIVEN** a user without a contractor profile
- **WHEN** the user navigates to the contractors page and clicks "New Contractor"
- **THEN** a dialog form opens with fields for bio, hourly rate, portfolio links, and linked user
- **WHEN** the user fills in required fields and submits
- **THEN** a contractor profile is created and appears in the contractors table

#### Scenario: User edits own contractor profile
- **GIVEN** a user with a contractor profile
- **WHEN** the user clicks "Edit" on their contractor row
- **THEN** a dialog opens pre-filled with their current profile data
- **WHEN** the user modifies fields and submits
- **THEN** the profile is updated

#### Scenario: Admin manages any contractor profile
- **GIVEN** an admin user
- **WHEN** the admin views the contractors page
- **THEN** all contractor profiles are shown with edit and delete actions
- **AND** the admin can link any user to a contractor profile

### Requirement: Contractors list view
The contractors page SHALL display a table of all contractor profiles with name, user email, hourly rate, and status.

#### Scenario: Contractors table displays
- **WHEN** a user with `contractors:view` permission navigates to `/dashboard/contractors`
- **THEN** a table is displayed with columns: name, user, hourly rate, status, portfolio links
- **AND** each row has edit and delete actions (based on permissions)

#### Scenario: Contractors page header
- **WHEN** the contractors page loads
- **THEN** the header shows "Contractors" title with a "New Contractor" button

### Requirement: Contractor profile is linked to a user
Each contractor profile SHALL be linked to a registered user account. The linked user's name and email are displayed in the contractors table.

#### Scenario: Contractor shows linked user info
- **WHEN** the contractors table is displayed
- **THEN** each row shows the linked user's name and email

#### Scenario: User without account can be linked
- **WHEN** an admin creates a contractor profile
- **THEN** the admin can select any registered user to link to the profile

### Requirement: Contractor status
Contractor profiles SHALL have a status field (active/inactive). Inactive contractors are still listed but visually distinguished.

#### Scenario: Active contractor is visually normal
- **GIVEN** a contractor with active status
- **WHEN** the contractors table is displayed
- **THEN** the row appears with standard styling

#### Scenario: Inactive contractor is visually dimmed
- **GIVEN** a contractor with inactive status
- **WHEN** the contractors table is displayed
- **THEN** the row appears with dimmed/muted styling

### Requirement: Contractor deletion protection
The system SHALL block deletion of contractors that are assigned to active projects. A confirmation dialog is required before deletion.

#### Scenario: Cannot delete contractor with active projects
- **WHEN** an admin attempts to delete a contractor that is assigned to active projects
- **THEN** the deletion is blocked with an error message

#### Scenario: Delete contractor confirmation
- **WHEN** an admin clicks delete on a contractor with no active project assignments
- **THEN** a confirmation dialog appears
- **AND** the contractor is deleted after confirmation

### Requirement: Contractor page permission gate
The contractors page SHALL require `contractors:view` permission to access.

#### Scenario: Authorized user accesses contractors page
- **GIVEN** a user with `contractors:view` permission
- **WHEN** the user navigates to `/dashboard/contractors`
- **THEN** the contractors page renders normally

#### Scenario: Unauthorized user is blocked
- **GIVEN** a user without `contractors:view` permission
- **WHEN** the user navigates to `/dashboard/contractors`
- **THEN** they are redirected to a forbidden page
