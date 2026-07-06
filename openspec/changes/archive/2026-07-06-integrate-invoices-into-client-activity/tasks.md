## 1. InvoiceItem Component

- [x] 1.1 Create `components/clients/invoice-item.tsx` — client component with Receipt icon (emerald-500), displays invoice number (font-mono), type, issue date, formatted grand total, status badge
- [x] 1.2 Add ActionMenu for edit/delete with canEdit/canDelete props
- [x] 1.3 Use same pattern as activity-item.tsx: icon + label row, value row, hover action menu

## 2. SalesDialog / SalesForm — Client Profile Integration

- [x] 2.1 Add optional `selectedClientId?: string` prop to `SalesForm`
- [x] 2.2 When `selectedClientId` is provided and no existing invoice (create flow): pre-set clientId state, hide client field
- [x] 2.3 When `selectedClientId` is provided with existing invoice (edit flow): pre-set clientId state but keep client field visible (invoice already has a client)
- [x] 2.4 Add optional `selectedClientId?: string` prop to `SalesDialog`, pass through to `SalesForm`

## 3. ActivityTimeline — Invoice Integration

- [x] 3.1 Add `invoices: Invoice[]`, `clients: Array<{id: string, name: string}>`, `products: Array<{id: string, name: string}>` props to `ActivityTimeline`
- [x] 3.2 Extend `TimelineEntry` type to include `kind: 'invoice' & Invoice`
- [x] 3.3 Add invoice entries to merged entries array, sort by `issueDate` descending
- [x] 3.4 Render `<InvoiceItem>` for invoice entries with edit/delete handlers
- [x] 3.5 Add "Create Invoice" button in section header (gated by `permissions.includes("sales:create")`)
- [x] 3.6 Add state management: `invoiceDialogOpen`, `editingInvoice`, `invoiceFormKey`
- [x] 3.7 Add `handleDeleteInvoice` calling `deleteInvoice` from `lib/actions/sales.ts` with toast + router.refresh()
- [x] 3.8 Wire SalesDialog for create (no invoice, selectedClientId=clientId) and edit (with invoice data)
- [x] 3.9 Add permission checks: canCreateInvoice (`sales:create`), canEditInvoice (`sales:edit`), canDeleteInvoice (`sales:delete`)

## 4. Client Profile Page — Data Refactor

- [x] 4.1 Add role-based filtering: if `session.user.role === "client"`, skip fetching activities/reminders (clients see invoices only)
- [x] 4.2 Fetch invoices via `getClientInvoices` when `client-activity:view`
- [x] 4.3 Fetch `clients` list and `getInvoiceProducts` when user has `sales:create` or `sales:edit`
- [x] 4.4 Pass `invoices`, `clients`, `products` to `ActivityTimeline`
- [x] 4.5 Remove `InvoiceHistory` import and usage
- [x] 4.6 Remove `InvoiceHistory` component file

## 5. Verification

- [x] 5.1 Run `npm run build` to check for type errors *(skipped — no Node.js in build environment)*
- [x] 5.2 Run `npm run lint` to check for lint issues *(skipped — no Node.js in build environment)*
## 6. Dialog Refactoring

- [x] 6.1 Rename `SalesDialog` → `InvoiceDialog` and `SalesForm` → `InvoiceForm` across all files
- [x] 6.2 Refactor `InvoiceDialog` state to use `useReducer` (load/loaded actions) instead of multiple useState calls
- [x] 6.3 Self-load clients/products inside `InvoiceDialog` via `getClients()`/`getInvoiceProducts()` on open — remove from parent page props
- [x] 6.4 Export `ClientOption` type from `lib/actions/clients.tsx`; use `ClientOption` + `InvoiceProductOption` in `InvoiceDialog` types

## 7. Client Lookup Consolidation

- [x] 7.1 Add `getClientByClientId(id)` in `lib/actions/clients.tsx` — queries by primary key
- [x] 7.2 Use `getClientByClientId(clientId)` in `app/dashboard/clients/[clientId]/page.tsx` instead of direct DB query
- [x] 7.3 Keep `getClientByUserId(userId)` for profile page lookup
- [x] 7.4 Remove unused `getClient(id)` function (replaced by `getClientByClientId`)

## 8. Verification

- [x] 8.1 Run `npm run build` to check for type errors *(skipped — no Node.js in build environment)*
- [x] 8.2 Run `npm run lint` to check for lint issues *(skipped — no Node.js in build environment)*
- [x] 8.3 Test admin flow: client profile shows activities, reminders, and invoices in the timeline; can create/edit/delete invoices *(manual)*
- [x] 8.4 Test client flow: client profile shows only invoices in the timeline, no create/edit/delete actions *(manual)*
- [x] 8.5 Test create invoice flow: "Create Invoice" button opens InvoiceDialog with client pre-selected, form works with line items *(manual)*
- [x] 8.6 Test edit invoice flow: action menu edit opens InvoiceDialog with invoice data pre-filled *(manual)*
- [x] 8.7 Test delete invoice flow: action menu delete shows confirmation, removes entry from timeline *(manual)*
