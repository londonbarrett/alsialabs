# Roles and permissions — Design

## Why this exists

The app is used by several kinds of people — super users, admins, retailers, clients, and plain users — whose access to features differs, and the set of modules and actions is expected to grow. Rather than hard-coding "admins can do X" scattered across the codebase, permissions are seeded as data: each module exposes a set of actions, each role is granted some subset, and a super user can retune those grants from a permissions page without a code change. The same permission data drives both the UI, which hides controls the caller cannot use, and the server actions, which independently reject work the caller is not permitted to do.

Getting this wrong has two failure modes. If the UI and the server disagree about permissions, either controls appear that then fail, or work is refused that the user can see how to start. The design therefore pushes a single server-computed set of permission codes down to the client and gates every mutation again on the server, so the two layers are always answering from the same seed data.

## Goals

- Seed permissions for the sales, clients, activity, and client-activity modules with the intended per-role grants.
- Let super users add, edit, and delete modules and toggle each module/action permission for any role.
- Hide UI controls and sidebar items the caller lacks permission for, and enforce the same permission in server actions.
- Deliver permission codes to the client through a provider rather than a global store.

## Design

### Seeded permissions per module

Permissions are created by the database seed script as `module:action` codes and become the rows a super user later toggles in the permission matrix.

The sales module seeds `sales:view`, `sales:create`, `sales:edit`, `sales:delete`, and `sales:view-invoice-history`. The super role gets all five; the admin role gets all except `sales:delete`; the client role gets only `sales:view-invoice-history`. The client-side detail of that last one matters: `sales:view-invoice-history` is seeded for both the admin and client roles, appears under the sales module in the permission matrix, and is toggleable per role. In the clients list it is what makes the "View" action visible on a client row.

The clients module seeds `clients:view`, `clients:create`, `clients:edit`, `clients:delete`, and `clients:invite`. The super role gets all of them; admin gets `clients:view`, `clients:create`, `clients:edit`, and `clients:invite` but not `clients:delete`; the client role gets none.

The activity module seeds `activity:view`. Both super and admin have it; the user role has no activity permissions. It shows up in the matrix with its view action and is toggleable per role.

The client-activity module seeds `client-activity:view`, `client-activity:create`, `client-activity:edit`, and `client-activity:delete`. It gates the client profile activity timeline and its items, which own their permission checks through `useHasPermission`. The super role gets all four; admin gets `view`, `create`, and `edit` (no delete); the retailer role gets all four; the user role gets only `client-activity:view`.

### Super users manage modules and grants

A super user manages modules — add, edit, and delete — with their associated actions on the permissions page. Adding a module (say "clients" with actions `view`, `create`, `edit`, `delete`) makes it appear in the permission matrix, with every action toggleable per role. Deleting a module removes it and its permissions from all roles.

Toggling a permission is the day-to-day operation. Turning a permission off for a role makes that role lose the associated capability, so users with that role can no longer perform the action and the UI reflects the restriction; turning it on grants the capability and lets those users act.

The permissions page itself is restricted to super users: an admin who navigates to `/app/permisos` sees a 403 forbidden page.

### UI hides what the caller cannot do

Controls for unauthorized actions simply do not render. An admin without `clients:delete` never sees the delete/trash button on a client row; the delete action is absent from the row's action menu. A super user, who holds all permissions, sees every action button (view, edit, delete). A user without `sales:view-invoice-history` similarly does not see the "View" action that the permission unlocks.

The sidebar follows the same rule: navigation items for a module are hidden when the user lacks that module's view permission. A user with no `clients:view` does not see the Clients link; a user with `clients:view` does.

### The server enforces permission independently

Every server action that modifies data checks the caller's permission before doing anything. A user without `clients:delete` who calls the `deleteClient` server action gets an error back and the client is not deleted, regardless of what the UI showed. This is what keeps a hidden control from being the only line of defense.

### Permissions reach the client through a provider

Permission codes are computed on the server and are immutable for the life of a request, so they are not placed in a module-level Zustand store. `app/app/layout.tsx` fetches them with `getUserPermissions(session.user.id)` and passes them as the `permissions` prop to `PermissionsProvider` in `components/common/permissions-provider.tsx`, which wraps the dashboard tree so every consumer sits inside it. Permissions are never pushed into a store from a component's render body: there is no `useStore.setState` during render, and the `StoreSync` component pattern does not exist.

`PermissionsProvider` builds its context value with `useMemo` keyed on `permissions`, so a new server array does not invalidate consumers on every render. It exposes `usePermissions(): string[]` and `useHasPermission(code: string): boolean` with those exact signatures, which makes gating a control a one-line call at the call site and lets a capability be composed from a role flag plus `useHasPermission`. A component gated on `sales:create`, for example, calls `useHasPermission("sales:create")` at the top level of render and conditionally renders on the result. `usePermissionsContext` throws an error naming the provider when no provider is mounted, so a missing wrap fails loudly instead of silently granting zero permissions. Because the data is immutable per request there is no `setPermissions` or `resetPermissions` action.

State hooks do not answer permission questions; they return role facts only, and the component composes the capability from those facts and the permission context. `useProjectContextState` at `stores/project-context/use-project-context-state.ts` does not expose `permissions` or any `can*` flag derived from them.

## Non-goals

- A module-level Zustand store for permissions, or pushing permission codes into a store from a component's render body.
- Permission flags in state hooks. They report role facts; gating is composed at the component from `useHasPermission`.
- Allowing non-super users to reach `/app/permisos`. That page is super-only.
