## Why

The client profile page currently has two disconnected sections: an Activity timeline (activities + reminders) and a separate Invoice History table. Invoices are financial interactions with clients and should appear in the activity timeline alongside calls, emails, meetings, notes, and reminders for a unified chronological view. Additionally, the client role should see only invoices (not activities/reminders) since invoices are the only client-facing record.

## What Changes

- Remove the standalone `InvoiceHistory` component from the client profile page
- Add invoices as entries in the `ActivityTimeline` alongside activities and reminders
- Create an `InvoiceItem` component for the timeline display (Receipt icon, invoice #, type, date, total, status, action menu)
- Add a "Create Invoice" button to the activity section header (gated by `sales:create`)
- Wire `InvoiceDialog` into the activity timeline for creating/editing invoices
- Add edit/delete action menus on invoice timeline entries (gated by `sales:edit`/`sales:delete`)
- Client role users see only invoices in the timeline (no activities, no reminders, no create/edit/delete)
- `InvoiceForm` gains optional `selectedClientId` to suppress the client selector when invoked from a client profile page

## Capabilities

### Modified Capabilities
- `client-activity`: Activity timeline now includes invoice entries; client role sees invoices only
- `sales`: Existing `InvoiceDialog`/`InvoiceForm` reused for create/edit from the client profile page

## Impact

- **Delete**: `components/clients/invoice-history.tsx` — replaced by timeline integration
- **New**: `components/clients/invoice-item.tsx` — invoice entry in the timeline
- **New**: `lib/actions/clients.tsx` — `getClientByClientId(id)`, `getClientByUserId(userId)`, `ClientOption` type
- **Modify**: `components/clients/activity-timeline.tsx` — add invoices, create/edit/delete handlers, InvoiceDialog integration
- **Modify**: `components/sales/sales-dialog.tsx` → renamed to `invoice-dialog.tsx` + refactored to `useReducer`
- **Modify**: `components/sales/sales-form.tsx` → renamed to `invoice-form.tsx` with optional `selectedClientId` prop
- **Modify**: `app/dashboard/clients/[clientId]/page.tsx` — role-based data filtering, pass invoices to timeline, uses `getClientByClientId`
- **Modify**: `app/dashboard/profile/page.tsx` — uses `ActivityTimeline` with invoices only via `getClientByUserId`
- **Modify**: `app/dashboard/sales/page.tsx` — updated imports after rename
- **Modify**: `components/sales/sales-list-view.tsx` — updated imports after rename
