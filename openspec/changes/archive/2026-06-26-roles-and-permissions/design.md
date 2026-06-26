## API / Architecture

### New Page: `/dashboard/permissions`
- Super-only page with permission matrix UI
- Modules column with action toggles per role (super, admin, client)
- Module management: add/edit/delete modules and their actions

### Server Actions (`lib/actions/permissions.ts`)
- `manageModule(action, name, actions)` — add/edit/delete a module with its action list
- `togglePermission(roleId, permissionId, enabled)` — enable/disable a permission for a role
- `getPermissions()` — fetch all permissions with role assignments (for matrix view)
- `getUserPermissions(userId)` — fetch all permission strings for a user (e.g., `["clients:view", "clients:create"]`)

### Server Action Guard Pattern
- `requirePermission(module, action)` — throws if caller lacks the permission
- Used in existing server actions: `deleteClient` checks `clients:delete`

### Permission Check Helper
- `hasPermission(userId, module, action): Promise<boolean>` — single permission check
- `hasPermissions(userId): Promise<string[]>` — fetch all permission strings for a user

### Sidebar Extensions
- `SidebarItem` gains optional `requiredPermission?: string` field (e.g., `clients:view`)
- `getSidebarMenu(role, permissions)` filters items by permission
- `AppSidebar` fetches permissions via `getUserPermissions()` on mount

## Technical Considerations

- Reuse existing schema tables: `permissions` (module/action), `role_permissions` (roleId/permissionId join)
- Seed data: super gets all permissions, admin gets specific module sets, client gets none
- Permissions fetched on every request (server action + component) — no caching
- Permission matrix component as a table with role columns and toggle switches
- Modify `getSidebarMenu` signature: `(role: string | null, permissions?: string[]) => SidebarSection[]`
- `deleteClient` in `lib/actions/clients.ts` gets `requirePermission('clients', 'delete')` guard
- Clients page passes `permissions` prop to client-side table component for UI gating

## Data Flow

1. User signs in → `session()` callback fetches role + user ID
2. Server actions call `requirePermission(module, action)` which queries `role_permissions` + `permissions`
3. Client components call `getUserPermissions(session.user.id)` to get permission strings
4. Sidebar and action buttons use permission strings to show/hide UI elements
