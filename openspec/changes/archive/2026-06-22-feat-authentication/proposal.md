## Why

The application needs to restrict access to authenticated users and provide self-hosted OAuth login via Google and Facebook. Without authentication, all pages are publicly accessible. User data must be owned entirely by the project — no third-party auth provider handles user information.

## What Changes

- Integrate Auth.js v5 as the authentication framework
- Add OAuth login with Google and Facebook providers (self-hosted, data in own database)
- Create a `/login` page with provider buttons
- Implement auth gates that redirect unauthenticated users to `/login`
- Add session persistence across page refreshes
- Add logout functionality that clears the session
- Set up Drizzle ORM schema for auth tables (User, Account, Session, VerificationToken)
- Connect to Supabase Postgres for data storage
- Organize routes into `(auth)` and `(dashboard)` route groups

## Capabilities

### New Capabilities
- `user-auth`: Authentication system with OAuth login (Google, Facebook), session management, auth gates, and logout — with user data stored in the project's own Supabase Postgres via Drizzle ORM

### Modified Capabilities
<!-- No existing capabilities are changing -->

## Impact

- **New dependencies**: `next-auth@beta`, `drizzle-orm`, `@auth/drizzle-adapter`, `postgres`, `drizzle-kit`
- **New route group**: `(auth)` for login, `(dashboard)` for authenticated pages
- **New routes**: `/login`, `/api/auth/[...nextauth]`
- **New files**: `lib/auth.ts`, `lib/drizzle/schema.ts`, `lib/drizzle/client.ts`
- **SessionProvider** wrapping the app layout
- **Environment variables**: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_FACEBOOK_ID`, `AUTH_FACEBOOK_SECRET`
- **Database tables**: `User`, `Account`, `Session`, `VerificationToken` in Supabase Postgres
- **Required OAuth configuration**: Google and Facebook OAuth apps with callback URLs pointing to `/api/auth/callback/google` and `/api/auth/callback/facebook`
