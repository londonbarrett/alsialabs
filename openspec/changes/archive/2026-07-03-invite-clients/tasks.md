## 1. Permissions Setup

- [x] 1.1 Add `invite` action to the `clients` module in `lib/drizzle/seed.ts`
- [x] 1.2 Run DB seed to apply new permission
- [x] 1.3 Add `requirePermission('clients', 'invite')` to the new server action

## 2. Server Action — inviteClient

- [x] 2.1 Create `inviteClient(clientId, email?)` in `lib/actions/clients.ts` with Zod validation
- [x] 2.2 Create user with `name` from client name, `email` from client email (or provided email), and assign `client` role
- [x] 2.3 Link the new user to the client via `client.user_id`
- [x] 2.4 Handle re-invite: if `client.user_id` already exists, resend email without creating duplicate user
- [x] 2.5 Handle no-email flow: accept optional `email` parameter, save to both `clients.email` and `users.email`
- [x] 2.6 Call `revalidatePath('/dashboard/clients')` on success

## 3. Email Sync on Client Upsert

- [x] 3.1 In `upsertClient`, if the client has a `user_id`, update `users.email` to match the new `clients.email`

## 4. Spanish Email Template

- [x] 4.1 Create `emails/client-invitation.tsx` with Spanish content using React Email components
- [x] 4.2 Use the Resend SDK to send the email (follow existing pattern from `lib/actions/users.tsx`)

## 5. UI — Action Menu and Invite Dialog

- [x] 5.1 Extend `ActionMenu` props with `canInvite` and `onInvite`
- [x] 5.2 Add "Invite" action item (shown when `onInvite` is provided and `canInvite` is true)
- [x] 5.3 In `components/clients/index.tsx`, pass `canInvite` and `onInvite` to ActionMenu per row
- [x] 5.4 Create invite dialog for clients without email (email input, pre-populated name, submit calls `inviteClient`)
- [x] 5.5 Wire up the invite flow: `onInvite` checks for email → opens dialog or calls `inviteClient` directly

## 6. Auth — Client Role Redirect

- [x] 6.1 In the auth login callback or dashboard redirect, check if user role is `client` and redirect to profile page

## 7. Permission Check — Frontend

- [x] 7.1 Pass `clients:invite` permission from the server page component to the client component
- [x] 7.2 Gate the `canInvite` prop based on `permissions.includes('clients:invite')`
