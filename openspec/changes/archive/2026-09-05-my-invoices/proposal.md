## Why

Clients linked via `clients.userId` currently see their invoices only embedded in the Profile timeline (`ActivityTimeline`), which mixes invoices with activities/reminders/payments. Staff already have a global Sales view but clients have no dedicated, read-only place to consult their own invoices, line items, and payment history. A focused "My Invoices" section under Navigation improves discoverability for all authenticated users.

## What Changes

- Add a new sidebar item **My Invoices** in the Navigation section, positioned above My Tasks, linking to `/dashboard/my-invoices`. Visible to everyone (no permission gate).
- Add a new route `app/dashboard/my-invoices/page.tsx` with `loading.tsx` that resolves the linked client via `clients.userId = session.user.id` (store-scoped) and displays that client's invoices as a simple list. No `forbidden()` gate; unauthenticated redirects to `/login`, unlinked client shows an empty state.
- Introduce server actions `getMyInvoices` (+ optional `getMyInvoiceItems`/`getMyInvoicePayments`) in `lib/actions/invoices.ts` that require only authentication and client ownership — no `client-activity:view` or `sales:view` check — and are store-scoped via `getEffectiveStoreId()`. Derive `overdue` status same as Sales.
- Build UI components `components/my-invoices/my-invoices-view.tsx` and `my-invoices-list.tsx` showing invoice number, issue/due date, status badge, totals, outstanding, with expandable view of line items and payment history. Read-only.
- Add i18n keys for `sidebar.myInvoices`, `breadcrumb.myInvoices`, and `myInvoices.*` (title, subtitle, empty states, columns) in `messages/en.json` and `messages/es.json`.
- Keep invoices on Profile (`app/dashboard/profile/page.tsx` + `ActivityTimeline`) unchanged.

## Capabilities

### New Capabilities
- `my-invoices`: Dedicated client invoice history page — sidebar entry, route, data access for own invoices, and read-only list with line items + payment history, guest-friendly empty states.

### Modified Capabilities
- `dashboard-navigation`: Add My Invoices item to the Navigation section (above My Tasks), no permission requirement, with active-highlight behavior.

## Impact

- Affected code: `config/sidebar-menu.ts`, `components/common/app-sidebar.tsx` (via config), `lib/actions/invoices.ts`, new `app/dashboard/my-invoices/*` and `components/my-invoices/*`, `messages/en.json`, `messages/es.json`, `components/dashboard-breadcrumb.tsx` (auto via translation key).
- No DB migration; reuses `invoice`, `invoice_item`, `invoice_payment`, `client`.
- No breaking changes to existing sales or profile flows.
