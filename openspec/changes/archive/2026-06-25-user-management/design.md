## Context

The app currently has no user management or role system. Authentication uses NextAuth v5 with Google and Facebook OAuth providers. The database has a `user` table with standard NextAuth fields but no role concept. Dashboard routes are manually protected in the layout by checking `session?.user`. Server actions check `session?.user` but have no role-based guards.

This feature introduces user management with three roles (super, admin, client) and establishes the database foundation for future role-based permissions.

## Goals / Non-Goals

**Goals:**
- Allow super users to create, edit, and delete users
- Assign one of three roles (super, admin, client) to each user
- Send invitation emails via Resend when a super creates a user
- Gate user management to super users only
- Create the database schema needed for future permissions (roles, permissions, role_permissions tables)
- Allow all authenticated users to view their own profile
- Show an empty dashboard placeholder on sign-in
- Protect `/dashboard/*` routes with `proxy.ts`
- Block self-registration — only invited users can sign in

**Non-Goals:**
- User self-registration or sign-up
- Roles and permissions management UI
- Advanced permission assignments per user

## Decisions

### Decision: Roles table with separate user_roles join table
**Rationale:** Although users have exactly one role, a `user_roles` table (with unique constraint on `user_id`) allows the next feature to easily change to many-to-many without a migration. A `roles` table rather than an enum column allows roles to carry metadata (description, display name) and be seeded with data.

**Alternatives considered:**
- **Text column on user table** — simpler but requires a migration to go many-to-many later
- **Enum in database** — works for fixed roles but harder to extend

### Decision: proxy.ts for auth gating
**Rationale:** Next.js 16 renamed `middleware.ts` to `proxy.ts`. This is the correct convention for the version in use. The proxy performs a lightweight session cookie check and redirects unauthenticated visitors to `/login`. Heavy validation (role checks, DB queries) happens at the page and action level.

**Alternatives considered:**
- **No proxy** — each layout/page does its own auth check, but this means unauthenticated visitors see a flash of protected content before redirect

### Decision: Resend for invitation emails
**Rationale:** Resend is free up to 3,000 emails/month, has a native Vercel integration, uses HTTP (not SMTP, which is blocked on Vercel), and pairs well with React Email for building email templates. The volume of invitation emails will be low.

**Alternatives considered:**
- **SendGrid** — free tier exists but SMTP is blocked on Vercel; API integration is more complex
- **Nodemailer with SMTP** — blocked on Vercel serverless functions
- **Custom SMTP** — operational overhead not justified for low volume

### Decision: Session role via NextAuth callbacks
**Rationale:** NextAuth v5's `jwt` and `session` callbacks are the standard way to embed custom data (like role) into the session. The `jwt` callback fetches the role on sign-in; the `session` callback exposes it to server components and client components via `useSession()`.

**Alternatives considered:**
- **Fetching role on every request** — more DB calls, no caching
- **Custom middleware reading cookies directly** — fragile, bypasses NextAuth's session management

### Decision: No self-registration
**Rationale:** Only invited users can sign in. This is enforced by checking that the user exists in the database at sign-in time (NextAuth `signIn` callback). If the OAuth email doesn't match an invited user, sign-in is rejected.

## Risks / Trade-offs

- **Risk: Resend email deliverability** → Mitigation: Verify a domain for production sending; use Resend's built-in DKIM/SPF configuration
- **Risk: Admin/client users cannot access the app until invited** → Mitigation: The seed script ensures at least one super user exists, and super users can invite others immediately
- **Risk: Deleting a user with existing data** → Mitigation: The `user_id` FK on the client table uses `ON DELETE SET NULL`, so deleting a user doesn't cascade-delete client records
- **Trade-off: user_roles table adds one JOIN for role lookup vs a direct column** → Acceptable: the number of users will be small, and the JOIN is on indexed PKs
