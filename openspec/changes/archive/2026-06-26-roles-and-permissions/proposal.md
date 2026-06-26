## Why

The app needs granular authorization beyond the binary super/not-super check. Admins should be able to view, create, and edit clients but not delete them. The sidebar should hide modules a user cannot access, and server actions should reject unauthorized calls.

## What Changes

- Add permission management UI at `/dashboard/permissions` (super-only) for managing modules, actions, and toggling permissions per role
- Create `hasPermission()` helper and `requirePermission()` server action guard
- Extend `getSidebarMenu(role)` to accept permissions and filter sidebar items
- Hide unauthorized UI actions (e.g., delete button) per permission
- Seed default permission sets for super, admin, and client roles
- Reuse existing `permissions` and `role_permissions` schema tables

## Capabilities

### New Capabilities
- `roles-permissions`: Granular module/action permissions with per-role assignment, UI enforcement, and server-side guards

### Modified Capabilities
- `client-crud`: Client delete action gated by `clients:delete` permission; sidebar visibility gated by `clients:view`
- `dashboard-navigation`: Sidebar menu filtered by user's permissions

## Impact

- `lib/drizzle/schema.ts` — permissions and role_permissions tables already exist, may need module seed data
- `lib/auth.ts` — add `hasPermission()` and `requirePermission()` exports
- `lib/actions/permissions.ts` — new server actions for module & permission management
- `lib/actions/clients.ts` — add `requirePermission('clients', 'delete')` guard to deleteClient
- `config/sidebar-menu.ts` — extend `getSidebarMenu()` to accept permissions list
- `components/users-table.tsx` — already role-gated, permissions not needed here
- `components/clients-table.tsx` — hide delete button based on `clients:delete`
- `app/dashboard/permissions/` — new super-only page
- `app/dashboard/clients/page.tsx` — pass permissions to client-side components
