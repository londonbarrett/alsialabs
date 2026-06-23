## Context

The clients listing page (`app/dashboard/clients/`) currently fetches all clients via Drizzle in a server component and passes them to a client component (`client-list-view.tsx`) that renders a table with an empty state and a CSV import button. Each row has a DropdownMenu with stubbed View/Edit/Delete actions (toast.info only). There is no UI for creating or editing individual clients. The `clientsTable` schema already exists with all required fields: id, name, phone (unique), location, comments, email, userId.

## Goals / Non-Goals

**Goals:**
- Reusable client form component that works for both create and edit modes
- Dialog overlay to host the form, triggered by "New Client" button and Edit action
- Server actions for create and update operations with auth guard, validation, and sanitization
- Client-side validation including duplicate phone detection
- Clients list revalidates after mutations
- Accessible form and dialog (keyboard navigation, ARIA, screen-reader support)

**Non-Goals:**
- Deleting clients (separate ticket)
- Linking clients to users
- Bulk operations beyond existing CSV import

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Form mode** | Single form component with optional `client` prop | If `client` is provided → edit mode (pre-fill, PATCH); if absent → create mode (empty fields). Avoids duplicating form logic. |
| **Validation** | Zod on both client and server | Zod is TypeScript-first, pairs well with Drizzle, and already fits the project's stack. Client-side validates before submit; server-side re-validates and sanitizes. |
| **Dialog** | shadcn Dialog component (`npx shadcn@latest add dialog`) | Already planned per project conventions. Dialog is the standard pattern for modal forms. Use `DialogTitle` for accessibility. |
| **Phone uniqueness** | Client-side check via server action + DB unique constraint | Client-side provides instant feedback; DB constraint ensures data integrity even if client check is bypassed. |
| **Duplicate submission** | `disabled` + spinner on submit button during request | Prevents double-submit. Existing Button + Spinner pattern from shadcn. |
| **Server action pattern** | Single file, possibly one action for both create/update | Simpler API. Check for `id` in data to determine insert vs update. |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **Race condition on phone uniqueness** | DB unique constraint is the source of truth. Client check is UX optimization only. |
| **Form becomes complex with many fields** | Keep form simple now; future features can add sections/steppers. |
| **Reusable form coupling** | Form component should not import dialog logic. Accept `onSubmit` callback to stay decoupled. |
