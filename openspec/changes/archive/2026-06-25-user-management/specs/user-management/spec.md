## ADDED Requirements

### Requirement: Super can view all users
The system SHALL allow super users to view a table of all users with their roles.

#### Scenario: Super views users
- **WHEN** a super user navigates to the user management page
- **THEN** they see a table listing all users with their name, email, and role

### Requirement: Super can create a user
The system SHALL allow super users to create new users by providing an email and selecting a role. The default role SHALL be "admin". An invitation email SHALL be sent to the new user via Resend.

#### Scenario: Super creates a user
- **WHEN** a super user fills in the create user form with an email and role
- **THEN** the user is added to the database
- **AND** an invitation email is sent to the provided email address
- **AND** the user appears in the user list

#### Scenario: Duplicate email on create
- **WHEN** a super user tries to create a user with an email that already exists
- **THEN** the system returns a validation error
- **AND** no duplicate user is created

### Requirement: Super can edit a user
The system SHALL allow super users to edit a user's role and details.

#### Scenario: Super edits a user
- **WHEN** a super user changes a user's role or details
- **THEN** the changes are saved immediately

#### Scenario: Super cannot demote self
- **WHEN** a super user tries to change their own role away from super
- **THEN** the change is rejected
- **AND** an error is shown

### Requirement: Super can delete a user
The system SHALL allow super users to delete users. A super user SHALL NOT be able to delete themselves. The system SHALL enforce at least one super user exists at all times.

#### Scenario: Super deletes a user
- **WHEN** a super user deletes another user
- **THEN** the user is removed from the database
- **AND** the user can no longer sign in

#### Scenario: Super cannot delete self
- **WHEN** a super user tries to delete their own account
- **THEN** the deletion is rejected
- **AND** an error is shown

#### Scenario: Last super cannot be deleted
- **WHEN** an admin or super tries to delete the only remaining super user
- **THEN** the deletion is rejected
- **AND** an error is shown

### Requirement: Invited user can sign in
The system SHALL allow invited users to sign in using Google or Facebook OAuth using the email address the super specified when creating the account.

#### Scenario: Invited user signs in
- **WHEN** an invited user signs in with Google or Facebook using the email associated with their account
- **THEN** they are granted access to the app
- **AND** they are redirected to the dashboard

#### Scenario: Visitor self-registration is blocked
- **WHEN** an unauthenticated visitor tries to sign up
- **THEN** they cannot create an account
- **AND** they must be invited by a super

### Requirement: User can view their profile
The system SHALL allow all authenticated users to view their own profile details including name, email, and role.

#### Scenario: User views profile
- **WHEN** any authenticated user navigates to their profile page
- **THEN** they see their name, email, and role

### Requirement: Authenticated user sees dashboard
The system SHALL redirect all authenticated users to an empty dashboard placeholder upon sign-in.

#### Scenario: User signs in
- **WHEN** a user signs in successfully
- **THEN** they are redirected to the dashboard
- **AND** they see an empty dashboard placeholder

### Requirement: Auth proxy guards dashboard routes
The system SHALL use a `proxy.ts` file to protect all `/dashboard/*` routes from unauthenticated access.

#### Scenario: Unauthenticated visitor is redirected
- **WHEN** an unauthenticated visitor tries to access any `/dashboard/*` page
- **THEN** they are redirected to the login page

### Requirement: Non-super users cannot access user management
The system SHALL restrict the `/dashboard/users` page to super users only. Non-super users SHALL receive a forbidden response.

#### Scenario: Client user tries to access user management
- **WHEN** a client user navigates to `/dashboard/users`
- **THEN** they see a forbidden error page
