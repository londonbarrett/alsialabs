## 1. Database Schema

- [x] 1.1 Add `roles` table to Drizzle schema with id, name, description
- [x] 1.2 Add `user_roles` table with user_id (FK, unique), role_id (FK)
- [x] 1.3 Add `permissions` table with id, module, action
- [x] 1.4 Add `role_permissions` table with role_id (FK), permission_id (FK)
- [x] 1.5 Add `role` to user table or migrate user_roles relation
- [x] 1.6 Create seed script for roles (super, admin, client)
- [x] 1.7 Generate and run Drizzle migration

## 2. Auth Configuration

- [x] 2.1 Add `jwt` callback to `lib/auth.ts` to embed role in token
- [x] 2.2 Add `session` callback to expose role in session
- [x] 2.3 Add `signIn` callback to check user exists (block self-registration)
- [x] 2.4 Augment NextAuth type declarations for `session.user.role`
- [x] 2.5 Export `requireAuth()` and `isSuperUser()` helper functions

## 3. Route Protection

- [x] 3.1 Create `proxy.ts` at project root with auth guard for `/dashboard/*`
- [x] 3.2 Configure `proxyConfig` matcher for protected routes
- [x] 3.3 Update `app/dashboard/layout.tsx` to use `requireAuth()`
- [x] 3.4 Create `app/forbidden.tsx` error page for 403 responses

## 4. User Management UI

- [x] 4.1 Create `app/dashboard/users/page.tsx` with super-only gate
- [x] 4.2 Build users table component showing all users with roles
- [x] 4.3 Build create user dialog/form with email and role selection
- [x] 4.4 Build edit user dialog/form for role and details
- [x] 4.5 Build delete user confirmation with guards (self-deletion, last super)
- [x] 4.6 Create server actions for user CRUD (createUser, updateUser, deleteUser)
- [x] 4.7 Add validation: no self-demotion, no last-super deletion

## 5. Invitation Emails

- [x] 5.1 Install and configure Resend SDK
- [x] 5.2 Create invitation email template with React Email
- [x] 5.3 Send invitation email on user creation via server action
- [x] 5.4 Add `RESEND_API_KEY` to `.env.example`

## 6. Profile Page & Dashboard

- [x] 6.1 Create `app/dashboard/profile/page.tsx` showing user details
- [x] 6.2 Update dashboard page to show empty placeholder
- [x] 6.3 Update sidebar config to show Users link (super only) and Profile link (all users)
- [x] 6.4 Update `AppSidebar` component to read role and render correct nav items

## 7. Test Auth & Setup

- [x] 7.1 Update `app/api/test/setup-auth/route.ts` to accept role param
- [x] 7.2 Create seed/migration script for initial super user
