# Sales invoicing — Design

## Why this exists

The sales page is where invoices are created, corrected, paid, and reviewed. It has to cover two very different kinds of billing — catalog products with auto-filled prices, and ad-hoc services described on the spot — through one dialog form, and it has to keep a dense table, payment state, and analytics in sync as invoices change. Because every interaction on this page is a server round-trip away from feeling sluggish, the page is optimistic end to end: rows appear, update, and disappear the instant the user acts, with the server's answer settling or reverting them.

The page also carries its own analytics — a monthly revenue chart and a top-clients ranking — computed from the same invoice data, so it doubles as the reporting surface for sales. Search and filtering keep a large table usable, and permissions gate every surface and every mutation.

## Goals

- Let users with `sales:view` see every invoice in a table, with the Sales nav link hidden from anyone lacking the permission.
- Create and edit invoices in product mode and service mode through one reusable dialog form.
- Compute line totals and invoice totals live, and recompute all totals authoritatively on the server.
- Gate every server action by authentication and the right `sales:*` permission.
- Show a monthly revenue chart and a top-10 clients chart with empty states.
- Search and filter the invoice table by text, status, and issue-date range.
- Keep the sales table and payment state fully optimistic through a page-scoped invoice store.

## Design

### Permissions gate the page and every mutation

The sales page renders a table of all invoices — number, client, type, issue date, due date, grand total, outstanding balance, status — for any authenticated user holding `sales:view`; the table shows invoices regardless of who created them. Without that permission the Sales link is not shown in the sidebar. Creation requires `sales:create`, editing requires `sales:edit`, and deletion requires `sales:delete` plus an explicit confirmation step. For non-admin users, deletion is further limited to invoices they created; an admin may delete any invoice, and a non-admin's attempt to delete someone else's invoice is rejected.

The server is the final gate. An unauthenticated call to any invoice server action returns an unauthorized error and modifies nothing; a call missing the required permission errors and leaves the invoice intact. Hiding the UI is convenience — the actions still check.

### One dialog serves create and edit, in either mode

The "New Invoice" button opens a dialog form containing a client field (an autocomplete combobox), a product/service type toggle, issue and due dates, an amount-paid field (create only), and a line-items table. In product mode each row has a product dropdown, quantity, unit price, discount %, tax %, and a computed line total; selecting a product auto-fills the description and unit price from the product catalog. In service mode the row's first column becomes a free-text description and the saved line items carry no product reference.

Edit opens the same dialog pre-filled with the invoice's data, all line items included, from the row action menu. Submitting an edit updates the invoice and replaces all its line items wholesale — the form owns the full set, not a diff. The invoice number itself is generated on creation, is unique, and never changes.

On successful submit the server action validates, recalculates, and creates or updates the invoice; the dialog closes, the sales table shows the new or updated row, and a success toast confirms. If the server returns an error, an error toast is shown and the dialog stays open so nothing is lost.

### Status derives from the amount paid

An invoice created with no amount paid starts as `draft`. If an amount paid is entered, the status is derived from it instead, and a payment record is created for that amount. The amount-paid input exists only at creation; payments after the fact go through the payment dialog.

### Client selection through `ClientCombobox`

The client field is a searchable autocomplete combobox built on Base UI's combobox pattern and encapsulated in a reusable `ClientCombobox` component. Typing filters the dropdown to clients whose name matches, case-insensitively, entirely client-side; clicking or pressing Enter on an option selects it and shows the client's name. In edit mode the field starts populated with the existing invoice's client while the dropdown still offers all other clients. Typing a name that matches nothing simply shows an empty dropdown — there is no inline client creation. Inside the dialog, the dropdown renders above the dialog overlay, and picking an option dismisses it.

### Line items and live totals

"Add Item" appends an empty row; each row's remove button deletes it and triggers recalculation. Totals recompute in real time as the user edits any row: the line total is `qty × unit_price × (1 - discount%/100) × (1 + tax%/100)`, and subtotal, discount total, tax total, and grand total update in the form footer on every change. The client-side math is for immediate feedback only; the server recalculates everything (see below), so what's stored never depends on what the browser computed.

### The server recalculates everything it stores

All input is validated and sanitized on the server. Malformed invoice data is rejected with a validation error and no data is modified. Totals submitted by the client are treated as untrusted: the server recomputes them from the raw line-item data and stores its own computed values, so a tampered grand total is corrected rather than persisted. Invoice numbers are assigned server-side on creation and are unique and immutable.

### The dialog and form are accessible

The dialog traps focus, closes on Escape, and Tab moves through the fields and line-item rows in logical order. On open, screen readers announce the dialog title — "New Invoice" or "Edit Invoice" — and every form field carries an associated label.

### `InvoiceForm` is reusable outside the dialog

The form component renders all fields and line items correctly on its own, outside any dialog. It takes an optional `invoice` prop to switch into edit mode, plus `onSuccess` and `onCancel` callbacks so a caller can drive its own dialog handling. The sales dialog is one consumer of it, not its container.

### Analytics: monthly revenue and top clients

The sales page shows a stacked bar chart of monthly revenue split by invoice type, with months on the x-axis, revenue on the y-axis, and each bar segmented into product and service revenue. Revenue is computed from invoice items, excluding any item with `unit_price = 0` — those items are left out of both revenue and quantity figures. Every month that has invoice data appears, ordered chronologically, no matter how many years back the data goes; a system with no invoices shows a placeholder message instead. Hovering a bar segment shows a tooltip with both the revenue amount and the quantity sold for that segment.

Alongside it, a horizontal bar chart ranks the top 10 clients by total invoice amount: client names on the y-axis, revenue on the x-axis, ordered highest to lowest, capped at 10. It shows the same no-data placeholder when there are no invoices.

### Search and filtering on the invoices card

The invoices table sits inside a card with filter controls above it and the count of matching results on the left. The filters are: a text search matching invoice number or client name case-insensitively, a status select with an "All statuses" option, and a from/to date range over issue dates. All filters combine — the table shows only invoices matching every active criterion. When any filter is active, a "Clear filters" button appears as the first control and resets everything. When nothing matches, a "no results" message replaces the table body while the filter controls stay visible, so the user can adjust or clear them.

`InvoiceFilters` owns this behavior: four `useState` values plus a `useMemo`-derived `filteredInvoices`, exposing the filtered list to its parent through a render-prop `children`. Its controls use shadcn `InputGroup` with a `Search` addon, a `Select` for status, and `Input type="date"` for the range, laid out with `gap-2` rounded units; the result count is rendered `aria-live`.

### The page is a server component; the view is a client component

`app/app/ventas/page.tsx` fetches the data and composes the layout. It calls `getInvoices()` from `actions/invoices.ts`, plus `getMonthlyRevenue` and `getTopClientsByRevenue` from `actions/sales.ts`, and unwraps each result via `unwrapResponse` from `lib/util/unwrap.ts`. It renders the `Page` layout (`components/common/page.tsx`) with a `PageHeader` (`components/common/page-header.tsx`) — title `sales.title`, subtitle `sales.subtitle`, icon `ChartNoAxesCombined` — translated on the server via `getTranslations("sales")`.

The page hands the fetched invoice array to the store's provider rather than to the view. The client `components/sales/sales-view.tsx` contains no `PageHeader` and no outer `div flex-1`; it renders the revenue charts (`MonthlyRevenueChart` and `TopClientsChart`, each in a `Card`) and `InvoicesCard` `components/sales/invoices-card.tsx`, and takes no `invoices` prop.

### `InvoicesCard` is fully optimistic over a page-scoped invoice store

`InvoicesCard` is a single component that owns the invoices table: it takes no props, reads the list via `useInvoiceState()` `stores/invoice/use-invoice-state.ts`, and never imports the store itself. The store is built by `InvoiceProvider` `components/sales/invoice-provider.tsx`, which is mounted by `app/app/ventas/page.tsx` — not by `InvoicesCard` — and seeded once per mount with the `InvoiceWithClientName[]` (declared in `components/sales/sales-invoice-table.tsx:17`) the page fetched. `SalesView` therefore receives no `invoices` prop, and there is no wrapper/content pair in which an outer component provides the store that an inner one consumes.

The store's state is `SalesState`, produced by `salesReducer` `stores/invoice/sales-reducer.ts`, which composes `invoiceReducer` `stores/invoice/invoice-reducer.ts` with `paymentReducer` `stores/invoice/payment-reducer.ts`. `useInvoiceActions` `stores/invoice/use-invoice-actions.ts` takes no arguments and returns only invoice mutations: `createInvoice`, `updateInvoice`, `deleteInvoice`, `cancelInvoice`, `reopenInvoice`, and `sendInvoice`. Each handler, on success, commits the server's `returning()` data through the store; on error it commits the rollback and toasts via `useActionError` `lib/util/action-errors.ts`. `createInvoice` and `updateInvoice` build their optimistic `replaceTemp`/`update` action inside the hook and return a `SettleResult` `lib/types.ts` — success plus optional server field errors — so `InvoiceForm` `components/sales/invoice-form.tsx` can render those errors.

### Dialogs delegate mutations to the route's action hook

`SalesInvoiceDialog` `components/sales/sales-invoice-dialog.tsx` and `TimelineInvoiceDialog` `components/clients/timeline-invoice-dialog.tsx` never import a server action and never call `run()` or `toast` themselves. On submit they call `createInvoice`/`updateInvoice` from whichever route hook is mounted — `useInvoiceActions` on the sales page, `useTimelineActions` `stores/timeline/use-timeline-actions.ts` on the client timeline — and use only the returned `SettleResult` to re-open the form on field errors. `InvoicesCard` renders `SalesInvoiceDialog`, the record variant of `PaymentDialog` `components/sales/payment-dialog.tsx`, and `PaymentHistoryDialog` `components/sales/payment-history-dialog.tsx` directly.

### Payments settle optimistically, including deletion

Recording a payment closes the dialog optimistically first — `handleRecordPaymentSubmit` `components/sales/invoices-card.tsx:53` flips `setPaymentDialog((s) => ({ ...s, open: false }))` — and then fires `recordPayment` from `usePaymentActions` `stores/invoice/use-payment-actions.ts` without awaiting it. That action updates the invoice's `paidAmount` and `status` optimistically through `salesReducer`. If the server rejects it, the rollback runs but the dialog does not reopen.

Deleting a payment goes through `PaymentHistory` `components/sales/payment-history.tsx` calling `usePaymentActions().deletePayment`, which routes a `deletePayment` action through the sales store. Because `salesReducer` patches both `paymentsByInvoiceId` and the parent invoice's `paidAmount`/`status` in the same pass, the `InvoicesCard` table reflects the deletion — recalculated outstanding balance and status included — with no `router.refresh`.

### Invoice domain stays separate from sales analytics

The schemas are split by entity: `InvoiceSchema`, `CreateInvoiceSchema`, `UpdateInvoiceSchema`, and `LineItemSchema` live in `actions/schemas/invoice.ts:16`; `PaymentSchema` lives in `actions/schemas/payment.ts:3`. There is no `UpsertInvoiceSchema`, and no `actions/schemas/sales.ts` re-export barrel.

The actions follow the same split. `getInvoices`, `getInvoiceProducts`, `getInvoiceItems`, `getInvoicePayments`, `createInvoice`, `updateInvoice`, `cancelInvoice`, `reopenInvoice`, `markInvoiceAsSent`, and `deleteInvoice` live in `actions/invoices.ts:471` as `sessionAction` (next-safe-action) handlers backed by the Zod `CreateInvoiceSchema`/`UpdateInvoiceSchema`. `recordPayment`, `updatePayment`, and `deletePayment` live in `actions/payments.ts:10` and reuse existing permissions rather than inventing one: `recordPayment` requires `sales:create` (`actions/payments.ts:12`), `updatePayment` requires `sales:edit` (`actions/payments.ts:125`), and `deletePayment` requires `sales:delete` (`actions/payments.ts:201`) — there is no `sales:record-payment` in `lib/drizzle/seed.ts:37`. Only `getMonthlyRevenue` and `getTopClientsByRevenue` remain in `actions/sales.ts:16`.

Tests sit beside the code they cover: `actions/invoices.test.ts` and `actions/payments.test.ts` next to the actions, `stores/invoice/invoice-store.test.ts` and `stores/invoice/payment-reducer.test.ts` next to the store code, and `lib/util/invoices.test.ts` next to the utilities. They exercise business logic — `computeInvoiceTotals` `lib/util/invoices.ts:26`, the `overdue` status derivation, `initialStatus` from `paidAmount`, `invoiceReducer` `stores/invoice/invoice-reducer.ts`, `paymentReducer`'s `add`/`update`/`delete`, and `canRecordPayment` validation — without mocking action logic, pulling in `vitest-drizzle-mock` only where a test needs `db`.

## Non-goals

- Inline client creation from the combobox. Unmatched names just show no results; clients are created elsewhere.
- A dedicated `sales:record-payment` permission. Recording, updating, and deleting payments reuse `sales:create`, `sales:edit`, and `sales:delete`.
- An `UpsertInvoiceSchema` or an `actions/schemas/sales.ts` re-export barrel. Schemas live with their entity.
- Passing `invoices` as a prop into `SalesView` or `InvoicesCard`, or wrapping a content component in a provider-providing component. The page mounts the provider; the card reads the store.
- Server-side or URL-persisted filtering. Filter state is local to `InvoiceFilters` and applied client-side.
