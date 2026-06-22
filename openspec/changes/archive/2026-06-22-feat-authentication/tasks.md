## 1. Dependencies and Environment

- [x] 1.1 Install next-auth@beta, drizzle-orm, @auth/drizzle-adapter, postgres, drizzle-kit
- [x] 1.2 Add DATABASE_URL (Supabase Postgres connection string) to .env
- [x] 1.3 Add AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_FACEBOOK_ID, AUTH_FACEBOOK_SECRET to .env
- [x] 1.4 Configure Google OAuth app (callback: /api/auth/callback/google)
- [x] 1.5 Configure Facebook OAuth app (callback: /api/auth/callback/facebook)

## 2. Drizzle Schema and Database

- [x] 2.1 Create drizzle client (lib/drizzle/client.ts)
- [x] 2.2 Create Drizzle schema for auth tables (lib/drizzle/schema.ts): User, Account, Session, VerificationToken
- [x] 2.3 Add drizzle.config.ts with Supabase Postgres connection
- [x] 2.4 Run drizzle-kit push to create tables in Supabase Postgres

## 3. Auth.js Configuration

- [x] 3.1 Create Auth.js config (lib/auth.ts) with DrizzleAdapter, Google and Facebook providers
- [x] 3.2 Create route handler (app/api/auth/[...nextauth]/route.ts)
- [x] 3.3 Create server-side auth() helper for React Server Components
- [x] 3.4 Add SessionProvider to root layout for client-side auth state

## 4. Auth Pages and Routes

- [x] 4.1 Create (auth) route group layout
- [x] 4.2 Create /login page with Google and Facebook sign-in buttons
- [x] 4.3 Add sign-out button to dashboard layout header
- [x] 4.4 Add auth gate to dashboard layout

## 5. Polish and Edge Cases

- [x] 5.1 Handle error states during OAuth (redirect with error parameter)
- [x] 5.2 Ensure login page is keyboard-navigable with proper focus management
- [x] 5.3 Add loading states during OAuth redirect
- [x] 5.4 Test full auth lifecycle: sign in → session persistence → sign out
