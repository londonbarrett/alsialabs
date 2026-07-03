## Context

The clients list view currently supports CRUD operations with an ActionMenu per row. The permission system uses RBAC with module-scoped actions (`clients:view`, `clients:create`, etc.). Email is handled via Resend + React Email (existing `emails/invitation.tsx` template for non-client users). The `clients` table already has a `user_id` FK to `users`.

This change adds an invite flow from the clients list view: create a user, assign `client` role, link to client, send Spanish invitation email.

## Goals / Non-Goals

**Goals:**
- Add "Invite" action to the clients list action menu, gated by `clients:invite` permission
- Create a user with `client` role and link via `client.user_id` on invite
- Send Spanish-language invitation email via Resend
- Handle clients without email (dialog prompt)
- Sync email between `client.email` and `users.email` on client form updates
- Re-invite resends email without duplicating user

**Non-Goals:**
- No dedicated client user management screen (handled in users module by super users)
- No custom/personalized email messages
- No bulk invite

## Decisions

1. **Single invite action in existing ActionMenu** — Follows the existing pattern of `canEdit`/`canDelete` props. Add `canInvite`/`onInvite`. Simple, minimal new props.

2. **`inviteClient` as a new server action in `lib/actions/clients.ts`** — Keeps client-related logic together. Follows existing `requirePermission('clients', 'invite')` + Zod + `revalidatePath` pattern.

3. **New Spanish email template `emails/client-invitation.tsx`** — Keeps existing English `InvitationEmail` for non-client users. Spanish template can be easily edited by non-developers. Uses React Email components consistent with existing template.

4. **Email sync on client upsert** — When `upsertClient` is called and the client has a `user_id`, update `users.email` to match `clients.email`. Simple, consistent with Option A (client is source of truth).

5. **Permission seed** — Add `'invite'` to the `clients` module actions. `super` and `admin` roles both get it by default.

## Risks / Trade-offs

- **Risk: Email sync could create unexpected login issues** — If an admin changes the client email to one already used by another user, the DB unique constraint will reject it. The upsert already handles Zod validation + DB errors gracefully.
- **Risk: No-email flow adds UX complexity** — The dialog intercepts the invite flow for a subset of clients. Mitigation: the dialog is a simple email prompt that submits to the same `inviteClient` action, keeping logic straightforward.
- **Trade-off: Resend API key may not be configured** — Following existing pattern, the email send is skipped if `RESEND_API_KEY` is unset, with no error shown. This is acceptable for local development.
