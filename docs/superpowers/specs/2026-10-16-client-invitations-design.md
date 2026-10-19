# Client invitations — Design

## Why this exists

Clients need an account to log in and see their own profile, their invoices, and their history, but there is no self-service signup for them. Instead, staff invite a client directly from the clients list, and the invitation creates the account, links it to the client record, and sends the credentials-and-link email in one action. Keeping invitation in the list's action menu means staff can act on a client where they already are, without a separate admin screen.

Inviting is idempotent from the staff's point of view: whether the client is brand new, missing an email, or already has an account, the same "Invite" action does the right thing. The invitation is also forgiving — a flaky email provider should never cost the admin their work, so the account is created regardless and the invite can simply be clicked again.

## Goals

- Let permitted admins invite a client from the clients list action menu.
- Create the client-role user and link it to the client record in one step.
- Handle clients with no email on record by prompting for one.
- Support re-inviting a client that already has an account without duplicating it.
- Send a Spanish invitation email, and not let email failure block the invite.
- Enforce the permission on the server, and route client users to their profile after login.

## Design

### Inviting from the clients list

Admins holding `clients:invite` see an "Invite" item in a client's action menu. Choosing it creates a user account with the `client` role, links that user to the client through `client.user_id`, and sends a Spanish invitation email to the client's email address. The invited client can then log in and is redirected to their own profile.

The action is only shown to those who may use it: a user lacking `clients:invite` simply does not see the "Invite" item in the action menu. The same rule is enforced at the server boundary, described below.

### Clients without an email

A client on record may have no email, in which case there is nothing to send an invitation to. In that case clicking "Invite" opens a dialog asking for the email, with the client's name already pre-populated so the admin knows they are editing the right client. On submit, the entered email is written to both `client.email` and the new `user` record, and the invitation proceeds normally — the user is created and the email sent.

### Re-inviting an existing account

Inviting a client who already has a linked user account does not create a second account. The existing account is left untouched and a fresh invitation email is sent to that user's email. This makes "Invite" safe to click again whenever an invitation needs to be resent.

### The invitation email

The email is written in Spanish and contains a login link for the client to access the platform, delivered through Resend. The template lives at `lib/emails/client-invitation.tsx` so its wording can be edited without touching the invite logic.

### Failure handling

If the email service fails during an invite, the user is still created and linked to the client, and no error is surfaced to the admin. The invite is therefore not rolled back by a delivery problem; because re-inviting is safe, the admin can simply click "Invite" again to retry sending the email.

### Server-side permission enforcement

The `inviteClient` action checks `clients:invite` on the server, independent of whether the button was visible. A caller without the permission receives an error, and no user or client data is modified.

### Client login redirect

Users with the `client` role are redirected to their own profile page after login, so an invited client lands where their invoices and history live rather than on an internal staff view.

## Non-goals

- Self-service signup for clients. Invitations are staff-initiated only.
- Rolling back the created account when the invitation email fails to send.
- Showing the "Invite" action to users without `clients:invite`; it is both hidden in the UI and rejected on the server.
</content>
