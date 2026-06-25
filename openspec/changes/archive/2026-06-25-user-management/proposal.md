## Why

The app currently has no user management system. Admins cannot create, edit, or invite users, and there is no role system to control access. This change introduces a user management capability that allows super users to manage all users, assign roles, and invite new users via email. It also establishes the database foundation for a future roles and permissions system.

## What Changes

- New `roles` table pre-seeded with super, admin, and client roles
- New `user_roles` table linking users to roles (unique constraint on user_id)
- New `permissions` and `role_permissions` tables (created but unused — reserved for future use)
- User management UI at `/dashboard/users` — super users only
- Profile page at `/dashboard/profile` — all authenticated users
- Invitation emails via Resend when a super creates a user
- `proxy.ts` for auth gating on `/dashboard/*`
- NextAuth v5 callbacks to embed role in session
- No self-registration — only invited users can sign in via Google/Facebook OAuth
- Empty dashboard placeholder on sign-in

## Capabilities

### New Capabilities
- `user-management`: Full user CRUD accessible to super users, including role assignment and invitation emails

### Modified Capabilities
<!-- No existing spec-level behavior is changing -->

## Impact

- **Schema**: New `roles`, `user_roles`, `permissions`, `role_permissions` tables; users linked to roles via `user_roles`
- **Auth**: NextAuth v5 callbacks updated to embed role; session type augmented
- **Infrastructure**: Resend API key needed for email delivery; React Email for templates
- **Routing**: `proxy.ts` at project root replaces no existing middleware; `/dashboard/users` and `/dashboard/profile` pages added
- **Dashboard sidebar**: Updated to conditionally show navigation items based on role
- **App access**: Only super users can initially access the app; admin/client users must be invited by a super
