## ADDED Requirements

### Requirement: Super can view all users
The system SHALL allow super users to view a table of all users with their roles via safe action `getUsers` (`sessionAction` `permission: users:manage` + `isSuperUser` guard, `unwrapResponse` with `[]` fallback).

#### Scenario: Super views users
- **WHEN** a super user navigates to the user management page
- **THEN** they see a table listing all users with their name, email, and role
- **AND** the page uses `unwrapResponse(result)` (returns `[]` by default for arrays, `lib/util/unwrap.ts:16`)

### Requirement: Super can create a user
The system SHALL allow super users to create new users via safe action `createUser` (`sessionAction` `permission: users:manage`, schema `createUserSchema: {email, roleId}`, `isSuperUser` guard) by providing an email and selecting a role. The default role SHALL be "admin". An invitation email SHALL be sent to the new user via Resend and `revalidatePath("/dashboard/users")` + `updateTag("permissions")` SHALL be called.

#### Scenario: Super creates a user
- **WHEN** a super user fills in the create user form with an email and role
- **THEN** the user is added to the database via `createUser` safe action
- **AND** an invitation email is sent to the provided email address
- **AND** the user appears in the user list

#### Scenario: Duplicate email on create
- **WHEN** a super user tries to create a user with an email that already exists
- **THEN** the system returns `EMAIL_ALREADY_EXISTS` via `returnActionError`
- **AND** no duplicate user is created

### Requirement: Super can edit a user
The system SHALL allow super users to edit a user's role and details via safe action `updateUser` (`sessionAction` `permission: users:manage`, schema `updateUserSchema: {userId: string.min(1), email, roleId}`, `isSuperUser` guard).

#### Scenario: Super edits a user
- **WHEN** a super user changes a user's role or details
- **THEN** the changes are saved immediately via `updateUser`

#### Scenario: Super cannot demote self
- **WHEN** a super user tries to change their own role away from super
- **THEN** the change is rejected with `CANNOT_DEMOTE_SELF`
- **AND** an error is shown via `translateError`

### Requirement: Super can delete a user
The system SHALL allow super users to delete users via safe actions (`sessionAction` with `permission: users:manage` and `isSuperUser` guard, schemas `deleteUserSchema: {userId: string.min(1)}`). Deletion SHALL be transactional (`db.transaction` delete `userRoles` then `users`) and SHALL block when the user owns projects (`projects.primaryOwnerId`), stores (`stores.owner_id`), or has `clientActivities`/`clientReminders` (return `REFERENCE_EXISTS`). Orphan users with no `userRoles` row SHALL still be deletable (checked via `usersTable` existence, not `userRoles`). A super user SHALL NOT be able to delete themselves. The system SHALL enforce at least one super user exists at all times. `test-user-*` prefixed IDs (non-UUID) SHALL be accepted.

#### Scenario: Super deletes a user
- **WHEN** a super user deletes another user
- **THEN** the user is removed from the database
- **AND** the user can no longer sign in

#### Scenario: Super cannot delete self
- **WHEN** a super user tries to delete their own account
- **THEN** the deletion is rejected with `CANNOT_DELETE_SELF`
- **AND** an error is shown via `translateError`

#### Scenario: Last super cannot be deleted
- **WHEN** an admin or super tries to delete the only remaining super user
- **THEN** the deletion is rejected with `CANNOT_DELETE_LAST_SUPER`
- **AND** an error is shown

#### Scenario: Delete blocked by references
- **WHEN** a super tries to delete a user who is primary owner of a project, owner of a store, or author of activities/reminders
- **THEN** the deletion is rejected with `REFERENCE_EXISTS`
- **AND** `Cannot delete: record is referenced by other data` is shown

#### Scenario: Orphan test user can be deleted
- **WHEN** a super deletes a `test-user-*` user with no `userRoles` row
- **THEN** the deletion succeeds (checked via `usersTable`, not `userRoles`)

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
