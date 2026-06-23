## Why

Clients can be imported via CSV but there is no way to manually add or edit individual clients through the UI. This limits day-to-day client management. Adding a dialog-based create/edit form gives users full control over their client data without leaving the clients page.

## What Changes

- Add a reusable client form component (fields: name, phone, location, comments, email)
- Add a "New Client" button next to "Import Data" on the clients page header
- Wire the Edit action in the row actions dropdown menu to open the same form in edit mode
- Add a server action for creating a client (auth-guarded, validates + sanitizes input)
- Add a server action for updating a client (auth-guarded, validates + sanitizes input)
- Add client-side form validation including duplicate phone detection
- Add server-side input validation and sanitization
- Revalidate the clients list after successful create/edit

## Capabilities

### New Capabilities
- `client-crud`: Create and update clients via a dialog form with client + server-side validation

### Modified Capabilities
<!-- No existing spec-level capabilities are being changed -->

## Impact

- New server actions in `lib/actions/` (following `import-clients.ts` pattern)
- New component for the client form (reusable)
- Modified `client-list-view.tsx` to wire the dialog and edit button
- Modified `app/dashboard/clients/page.tsx` to support the dialog
- E2E tests in `e2e/clients.spec.ts` need new scenarios
- No new DB migrations needed — `clientsTable` already has all required columns
