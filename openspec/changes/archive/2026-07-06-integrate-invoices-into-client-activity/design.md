## Context

The client profile page at `app/dashboard/clients/[clientId]/page.tsx` currently renders:

1. Client info card
2. `ActivityTimeline` (activities + reminders, sorted by date desc)
3. `InvoiceHistory` (standalone table, below activity)

Invoices are fetched via `getClientInvoices()` and passed to `InvoiceHistory`. Activities/reminders use `getActivities()`/`getReminders()`. All three gate on `client-activity:view` permission.

The `SalesDialog` at `components/sales/sales-dialog.tsx` provides a full invoice creation/editing form with line items, product selection, auto-calculated totals. It requires `clients[]` and `products[]` for its dropdowns.

## Goals / Non-Goals

**Goals:**
- Display invoices in the activity timeline as distinct entries alongside activities and reminders
- Allow creating invoices from the activity section (reuse existing SalesDialog)
- Allow editing and deleting invoices from the timeline action menu
- Client role sees only invoices in the timeline (no activities, reminders, or create/edit/delete)
- Reuse existing permissions: `client-activity:view` for viewing, `sales:create/edit/delete` for mutations

**Non-Goals:**
- New invoice schema or migrations
- New permissions
- Invoice creation outside of SalesDialog (the full line-item form is the only creation path)
- Bulk operations on invoices from the timeline
- Notification on invoice creation

## Decisions

- **Invoices as timeline entries**: Invoices get `kind: 'invoice'` in `TimelineEntry`, sorted by `issueDate` alongside `activityDate` and `remindAt`. This gives a unified chronological feed.
- **Reuse InvoiceDialog (renamed from SalesDialog)**: Rather than building a simplified invoice dialog, the existing `SalesDialog`/`SalesForm` was reused and renamed to `InvoiceDialog`/`InvoiceForm`. It accepts an optional `selectedClientId` prop to pre-select and hide the client field when invoked from a client profile page context.
- **InvoiceDialog self-loads data**: Rather than pre-fetching clients/products in the page component, `InvoiceDialog` fetches them internally via `getClients()`/`getInvoiceProducts()` when opened. This eliminates prop-drilling from parent pages.
- **useReducer for dialog state**: `InvoiceDialog` uses `useReducer` with `load`/`loaded` actions to manage clients, products, and loading state in a single dispatch, avoiding cascading renders from synchronous setState calls in effects.
- **ClientOption / InvoiceProductOption types**: Reused existing return-type types (`ClientOption` from clients.tsx, `InvoiceProductOption` from sales.ts) instead of inline type annotations.
- **Client role filtering**: The page component checks `session.user.role === "client"` to decide whether to fetch activities/reminders. Clients only get invoices. This is simpler than passing roles into the component and filtering there.
- **Read-only for clients**: Clients have `client-activity:view` but not `sales:create/edit/delete`, so their timeline entries naturally have no action menus. No additional gating needed.
- **ActionMenu pattern**: Invoice entries reuse the same `ActionMenu` component as activities and reminders for edit/delete, keeping UI consistent.
- **Single client lookup function**: `getClientByClientId(id)` queries by primary key (for client detail page), `getClientByUserId(userId)` queries by user FK (for profile page). Both share the same `idSchema` validation pattern.
- **No direct DB queries in page components**: All database access is encapsulated in actions (`getClientByClientId`, `getClientByUserId`, `getClientInvoices`, etc.)
- **No new spec**: This change modifies existing `client-activity` and `client-crud` specs by adding invoices to the timeline; no new capability is introduced.

## Risks / Trade-offs

- **SalesDialog complexity**: The full SalesDialog with line items may feel heavy when invoked from the activity section. However, reusing it avoids building and maintaining a parallel simplified form. The dialog is modal so context is maintained.
- **Client role data exposure**: Clients only see invoice entries. The permission gate (`client-activity:view`) is already in place. No additional data leak risk.
- **Products list fetch**: When the page loads for a user with `sales:create`, it fetches all products. For large product catalogs this could be a perf concern, but acceptable for current scale.
