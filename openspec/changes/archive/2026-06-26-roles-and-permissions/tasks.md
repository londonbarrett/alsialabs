## 1. Seed & Schema

- [x] 1.1 Seed default modules (clients) and actions (view, create, edit, delete) in permissions table
- [x] 1.2 Seed role_permissions: super gets all, admin gets clients view/create/edit, client gets none
- [x] 1.3 Create seed migration or update existing seed script

## 2. Permission Helpers

- [x] 2.1 Create `hasPermission(userId, module, action)` helper in `lib/auth.ts`
- [x] 2.2 Create `getUserPermissions(userId)` helper to fetch all permission strings
- [x] 2.3 Create `requirePermission(module, action)` server action guard
- [x] 2.4 Export all helpers from `lib/auth.ts`

## 3. Server Actions

- [x] 3.1 Create `lib/actions/permissions.ts` with `manageModule(action, name, actions)`
- [x] 3.2 Add `togglePermission(roleId, permissionId, enabled)` action
- [x] 3.3 Add `getPermissions()` action for the matrix view
- [x] 3.4 Add `requirePermission('clients', 'delete')` guard to `deleteClient` in `lib/actions/clients.ts`

## 4. Permissions Page

- [x] 4.1 Create `app/dashboard/permissions/page.tsx` with super-only gate
- [x] 4.2 Build permission matrix component with module rows and role columns
- [x] 4.3 Build module management UI (add/edit/delete modules with actions)
- [x] 4.4 Add toggle switches for enabling/disabling permissions per role

## 5. Sidebar & UI Enforcement

- [x] 5.1 Add `requiredPermission?: string` field to `SidebarItem` interface
- [x] 5.2 Update `getSidebarMenu(role, permissions)` to filter by permissions
- [x] 5.3 Update `AppSidebar` to fetch permissions and pass to `getSidebarMenu`
- [x] 5.4 Gate delete button visibility in clients table with `clients:delete`
- [x] 5.5 Gate clients page access with `clients:view` permission

## 6. E2E Tests

- [x] 6.1 Test super can manage modules on permissions page
- [x] 6.2 Test super can toggle permissions per role
- [x] 6.3 Test admin sees clients page without delete button
- [x] 6.4 Test sidebar hides Clients for user without clients:view
- [x] 6.5 Test non-super sees 403 on permissions page
- [x] 6.6 Test unauthorized server action is rejected
