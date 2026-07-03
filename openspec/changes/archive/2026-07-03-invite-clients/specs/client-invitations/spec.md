## ADDED Requirements

### Requirement: Admin can invite a client from the clients list
The system SHALL allow admins with `clients:invite` permission to invite a client from the clients list view action menu.

#### Scenario: Successful first-time invite
- **WHEN** the admin opens the actions menu for a client
- **AND** clicks "Invite"
- **THEN** a user account is created with the `client` role
- **AND** the user is linked to the client via `client.user_id`
- **AND** a Spanish invitation email is sent to the client's email
- **AND** the client can log in and is redirected to their profile

#### Scenario: Invite button hidden without permission
- **GIVEN** the admin lacks `clients:invite` permission
- **WHEN** viewing a client row
- **THEN** the "Invite" action is not visible in the action menu

### Requirement: Admin can invite a client without an email
The system SHALL prompt for an email address when inviting a client that has no email on record.

#### Scenario: No-email client is prompted for email
- **WHEN** the admin clicks "Invite" on a client without an email
- **THEN** a dialog appears asking for the client's email
- **AND** the client's name is pre-populated in the dialog
- **WHEN** the admin enters an email and submits
- **THEN** the email is saved to both `client.email` and the new `user` record
- **AND** the invitation proceeds (user created, email sent)

### Requirement: Admin can re-invite a client with an existing account
The system SHALL allow re-inviting clients that already have a linked user account, resending the invitation email.

#### Scenario: Re-invite resends email
- **GIVEN** the client already has a linked user account
- **WHEN** the admin clicks "Invite" on that client
- **THEN** a new invitation email is sent to the existing user's email
- **AND** the existing user account is unchanged (no duplicate user created)

### Requirement: Invitation email is in Spanish
The system SHALL send a Spanish-language invitation email with a link for the client to access the platform.

#### Scenario: Email content and delivery
- **WHEN** a client is invited successfully
- **THEN** an email in Spanish is sent via Resend
- **AND** the email contains a login link to the platform
- **AND** the email template is editable at `emails/client-invitation.tsx`

### Requirement: Failed email delivery does not block the invite
The system SHALL complete the user creation even if the email fails to send, allowing the admin to retry later.

#### Scenario: Email failure is handled gracefully
- **WHEN** the email service fails during invite
- **THEN** the user is still created and linked to the client
- **AND** no error is shown to the admin
- **AND** the admin can click "Invite" again to resend the email

### Requirement: Invite action requires permission check server-side
The system SHALL reject invite requests from users without `clients:invite` permission at the server level.

#### Scenario: Unauthorized invite is rejected
- **WHEN** a user without `clients:invite` permission calls `inviteClient`
- **THEN** the action returns an error
- **AND** no user or client data is modified

### Requirement: Client users are redirected to profile on login
The system SHALL redirect users with the `client` role to their profile page after login.

#### Scenario: Client role redirect
- **GIVEN** a user with the `client` role
- **WHEN** they log in
- **THEN** they are redirected to their profile page
