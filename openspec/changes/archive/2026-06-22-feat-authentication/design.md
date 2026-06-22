## Context

The application needs authentication as its foundation. Auth.js v5 is chosen as the self-hosted auth framework — no third-party auth provider handles user data. Drizzle ORM connects to Supabase Postgres (database only) which stores User, Account, Session, and VerificationToken tables.

## Goals / Non-Goals

**Goals:**
- Self-hosted OAuth login with Google and Facebook providers
- Auth gates redirecting unauthenticated users to `/login`
- Session persistence across page refreshes
- Logout clearing the session
- User data stored in the project's own database via Drizzle ORM

**Non-Goals:**
- Email/password authentication
- Multi-factor authentication
- API token generation
- Role-based access control (future concern)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth framework | Auth.js v5 (`next-auth@beta`) | Self-hosted, no third-party data access, native Next.js App Router support, extensive OAuth provider support |
| Database ORM | Drizzle | SQL-like TypeScript syntax, type-safe, no proprietary DSL, lightweight, `@auth/drizzle-adapter` available |
| Database | Supabase Postgres | Already have account, free tier, standard PostgreSQL (not Auth API) |
| Database driver | `postgres` | Lightweight, modern, supports Supabase PG SSL connections |
| Route structure | Route groups `(auth)` / `(dashboard)` | Clear separation of public vs authenticated layouts |
| OAuth providers | Google + Facebook | Product requirement |

## Risks / Trade-offs

- **OAuth token expiry** → Auth.js handles refresh via database sessions; JWT strategy means no refresh needed
- **Account linking** → Same email across Google and Facebook: Auth.js creates separate accounts by default. Needs custom logic for auto-linking or manual merge
- **Facebook OAuth app review** → Facebook requires app review for public OAuth; use development mode during early stages
- **Supabase PG connection pool** → Supabase's PgBouncer has connection limits on free tier; Drizzle with `postgres` driver handles pooling via env config
- **Auth.js beta stability** → `next-auth@beta` (v5) is in beta but widely used in production
