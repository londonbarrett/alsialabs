## Why

Admins need a way to invite clients to the platform so they can log in and access their dashboard. Currently there is no way to grant client access — this change adds the full invite flow from the clients list view.

## What Changes

- Add "Invite" action to the per-row action menu on the clients list view, gated by `clients:invite` permission
- Create a server action `inviteClient` that creates a user, assigns the `client` role, links it to the client via `client.user_id`, and sends a Spanish invitation email
- Add `invite` to the `clients` module permission actions in the seed, assigned to `super` and `admin` roles
- For clients without an email, show a dialog prompting for email before proceeding; save email to both `client.email` and `user.email`
- Sync email changes: when the client form updates `clients.email`, also update the linked `users.email`
- Create a new Spanish-language React Email template `emails/client-invitation.tsx`
- On login, clients are redirected to their profile page
- Re-inviting an existing client resends the invitation email without duplicating the user

## Capabilities

### New Capabilities
- `client-invitations`: Flow for inviting clients — user creation, role assignment, email notification, and re-invite handling

### Modified Capabilities
- `client-crud`: Add "Invite" action to the clients list action menu; email field sync between client and linked user

## Impact

- **Schema**: `clients.user_id` already exists — no schema change needed
- **Permissions**: Seed data updated with `clients:invite` action
- **Server actions**: New `inviteClient()` in `lib/actions/clients.ts`; update `upsertClient()` to sync email with linked user
- **Components**: `ActionMenu` extended with `canInvite`/`onInvite` props; new invite dialog for email-less clients
- **Email**: New Spanish template `emails/client-invitation.tsx`
- **Auth**: Client users redirected to profile on login
