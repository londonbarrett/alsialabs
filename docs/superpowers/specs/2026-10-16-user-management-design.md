# User management — Design

## Why this exists

Accounts are not self-service. A super user is the only person who can bring someone into the app, and they do it by creating a user record and sending an invitation; the invited person then signs in with Google or Facebook using the email the super specified. This keeps the user list curated rather than open to anyone who finds the login page.

Once accounts exist, the super user needs to correct roles, remove people who have left, and be protected from the two ways an operation like this can go wrong: deleting the last super user, or deleting someone whose records other data still points at. Alongside the CRUD, the app needs the ordinary scaffolding every authenticated product needs — a profile page, a landing behavior after sign-in, and route guards that keep anonymous visitors out and keep non-super users away from the management pages.

## Goals

- Let super users list, create, edit, and delete users.
- Deliver invitations by email and let invited users sign in through OAuth.
- Protect super users from destructive self-operations and from breaking references.
- Provide profile viewing, role-based dashboard redirects, and route guards.

## Design

### Listing users

Super users view a table of all users with their name, email, and role on the user management page. It is backed by the safe action `getUsers`, a `sessionAction` with `permission: users:manage` and an `isSuperUser` guard. The page reads its result through `unwrapResponse(result)`, which returns `[]` by default for array results (`lib/util/unwrap.ts:16`), so an absent or failed result renders an empty list rather than throwing.

### Creating users and sending invitations

`createUser` is a `sessionAction` with `permission: users:manage`, an `isSuperUser` guard, and the schema `CreateUserSchema: {email, roleId}`. The super user supplies an email and selects a role, with the default role being "admin". On success an invitation email is sent through Resend, and the action calls `revalidatePath("/app/usuarios")` plus `updateTag("permissions")`. The new user then appears in the list. If the email already belongs to a user, the action returns `EMAIL_ALREADY_EXISTS` through `returnActionError` and creates no duplicate.

### Editing users

`updateUser` is a `sessionAction` with `permission: users:manage`, an `isSuperUser` guard, and the schema `UpdateUserSchema: {userId: string.min(1), email, roleId}`. A role or detail change is saved immediately. A super user cannot change their own role away from super: that attempt is rejected with `CANNOT_DEMOTE_SELF` and surfaced as an error through `translateError`.

### Deleting users

Deletion runs through safe actions that are `sessionAction`s with `permission: users:manage` and an `isSuperUser` guard, using the schema `DeleteUserSchema: {userId: string.min(1)}`. The delete is transactional — a `db.transaction` removes the user's `userRoles` rows and then the `users` row.

Before deleting, the action blocks if the user is referenced elsewhere: as the `projects.primaryOwnerId` of a project, as the `stores.owner_id` of a store, or as the author of `clientActivities` or `clientReminders`. Any of those returns `REFERENCE_EXISTS`, shown as `Cannot delete: record is referenced by other data`. A user with no `userRoles` row is still deletable — the existence check runs against `usersTable`, not `userRoles` — so orphan `test-user-*` users can be cleaned up. Those prefixed IDs are non-UUID and are accepted. A super user cannot delete themselves (`CANNOT_DELETE_SELF`), and the system always keeps at least one super user, so deleting the only remaining super returns `CANNOT_DELETE_LAST_SUPER`. Both self-deletion and last-super refusals are shown as errors. After a successful delete the user can no longer sign in.

### Invitations and sign-in

An invited user signs in with Google or Facebook using the email address the super specified when creating the account; on success they are granted access and redirected to the dashboard. There is no path for a visitor to register themselves: an unauthenticated visitor who tries to sign up cannot create an account and must be invited by a super.

### Profile, dashboard, and route guards

Any authenticated user can view their own profile — name, email, and role. After sign-in, every authenticated user is sent to `/app`; `app/app/page.tsx` then redirects by role, sending `user` to `/app/perfil` and everyone else to `/app/actividad`. Both `app/(auth)/login/page.tsx` and `app/page.tsx` redirect already-authenticated users to `/app` via `auth()` plus `redirect('/app')`, and `signIn(..., {redirectTo: '/app'})` lands the OAuth callback there.

Route protection lives in `proxy.ts`, which defines `proxy = auth((request) => ...)` and `proxyConfig: ['/', '/login', '/app/:path*']`. An unauthenticated visitor trying to reach any `/app/*` page is redirected to `/login`, and an authenticated user trying to reach `/` or `/login` is redirected to `/app`.

The user management page at `/app/usuarios` is restricted to super users; a non-super user, such as a client, who navigates there sees a forbidden error page.

## Non-goals

- Self-registration. Visitors cannot create accounts; access is by invitation from a super user.
- Allowing a super user to demote or delete their own account.
- Allowing deletion of the last super user or of a user referenced by other data.
- Letting non-super users reach `/app/usuarios`.
