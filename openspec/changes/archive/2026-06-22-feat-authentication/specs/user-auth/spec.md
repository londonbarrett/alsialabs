## ADDED Requirements

### Requirement: User signs in with Google
The system SHALL allow users to sign in using their Google account via OAuth, with all user data stored in the project's own Supabase Postgres database.

#### Scenario: Successful Google OAuth sign in
- **WHEN** the user is on the login page
- **WHEN** they click "Sign in with Google"
- **THEN** they are redirected to Google's OAuth consent screen
- **THEN** after authorizing, they are redirected back to the application
- **THEN** a User record is created in the project's database
- **THEN** they are logged in
- **THEN** they are redirected to the dashboard

#### Scenario: Google OAuth access revoked
- **WHEN** the user previously signed in with Google
- **WHEN** Google revokes the OAuth access
- **THEN** the user's session becomes invalid
- **THEN** they are prompted to sign in again

### Requirement: User signs in with Facebook
The system SHALL allow users to sign in using their Facebook account via OAuth.

#### Scenario: Successful Facebook OAuth sign in
- **WHEN** the user is on the login page
- **WHEN** they click "Sign in with Facebook"
- **THEN** they are redirected to Facebook's OAuth consent screen
- **THEN** after authorizing, they are redirected back to the application
- **THEN** a User record is created in the project's database
- **THEN** they are logged in
- **THEN** they are redirected to the dashboard

#### Scenario: Facebook OAuth access revoked
- **WHEN** the user previously signed in with Facebook
- **WHEN** Facebook revokes the OAuth access
- **THEN** the user's session becomes invalid
- **THEN** they are prompted to sign in again

### Requirement: Auth gate on protected routes
The system SHALL redirect unauthenticated users to the login page.

#### Scenario: Unauthenticated user visits protected route
- **WHEN** the user is not logged in
- **WHEN** they try to access any page other than /login
- **THEN** they are redirected to /login

### Requirement: Session persists across page refreshes
The system SHALL maintain the user session across page refreshes.

#### Scenario: Session survives page refresh
- **WHEN** the user is logged in
- **WHEN** they refresh the page
- **THEN** their session is still active
- **THEN** they remain on the current page

### Requirement: User can log out
The system SHALL allow users to log out, clearing their session.

#### Scenario: Successful logout
- **WHEN** the user is logged in
- **WHEN** they click "Sign out"
- **THEN** their session is cleared from the database
- **THEN** they are redirected to /login

### Requirement: Network failure handling during OAuth
The system SHALL handle network failures gracefully during OAuth sign in.

#### Scenario: Network failure during OAuth
- **WHEN** the user is on the login page
- **WHEN** they attempt to sign in with an OAuth provider
- **WHEN** there is a network failure
- **THEN** they see an appropriate error message
- **THEN** they can retry

### Requirement: Account linking across providers
The system SHALL handle the case where the same email is used with Google and Facebook.

#### Scenario: Same email used with different providers
- **WHEN** the user signs in with Google using email user@example.com
- **WHEN** they later sign in with Facebook using email user@example.com
- **THEN** the system handles account linking or deduplication appropriately

### Requirement: Keyboard-navigable login page
The login page SHALL be fully keyboard-navigable.

#### Scenario: Tab through login page
- **WHEN** the user is on the login page
- **WHEN** they press Tab
- **THEN** focus moves sequentially through interactive elements (provider buttons)
- **THEN** all interactive elements are reachable and operable via keyboard

### Requirement: User data stored in project's database
The system SHALL store all user, account, and session data in the project's own Supabase PostgreSQL database via Drizzle ORM.

#### Scenario: User record created in database
- **WHEN** a user signs in with an OAuth provider for the first time
- **THEN** a User record is created in the project's database
- **THEN** an Account record is created linking the OAuth provider to the User
- **THEN** a Session record is created for the user's session
