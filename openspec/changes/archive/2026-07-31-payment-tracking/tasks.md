## 1. Schema & Migration

- [x] 1.1 Add `dueDate`, `paidAmount` columns to `invoicesTable` in `lib/drizzle/schema.ts`
- [x] 1.2 Create `invoicePaymentsTable` (table `"invoice_payment"`) in `lib/drizzle/schema.ts` with id, invoiceId, amount, paymentDate, method, reference, notes, createdAt, userId
- [x] 1.3 Generate Drizzle migration with `npx drizzle-kit generate` (0014)
- [x] 1.4 Review generated migration SQL for correctness
- [x] 1.5 Run migration with `npx drizzle-kit migrate`

## 2. Server Actions

- [x] 2.1 Update `upsertInvoice()` in `lib/actions/sales.ts` to accept `dueDate` and `paidAmount`; on create, set initial status from paid amount (`draft` / `partially_paid` / `paid`)
- [x] 2.2 Create `recordPayment()` action in `lib/actions/sales.ts` — validates payment, updates `paidAmount` on invoice, inserts payment record
- [x] 2.3 Create `cancelInvoice()` action in `lib/actions/sales.ts` — sets status to "cancelled"
- [x] 2.4 Create `markInvoiceAsSent()` action in `lib/actions/sales.ts` — sets status to "sent" (labeled "Send Invoice" in the UI)
- [x] 2.5 Create `reopenInvoice()` action in `lib/actions/sales.ts` — sets a cancelled invoice back to "draft"
- [x] 2.6 Create `getInvoicePayments()` action — returns payment records for a given invoice
- [x] 2.7 Update `getInvoices()` to compute and return `outstandingBalance` and derived status (overdue detection)
- [x] 2.8 When creating an invoice with `paidAmount > 0`, insert a matching `invoice_payment` row so payment history is consistent

## 3. Types & Interfaces

- [x] 3.1 Export `InvoicePayment` type from `inferSelect` on `invoicePaymentsTable`
- [x] 3.2 Derive `InvoiceWithClient` from `Invoice` in `lib/actions/sales.ts`, adding `clientName` and `outstandingBalance`
- [x] 3.3 Replace `InvoiceItemData` with the schema `InvoiceItem` type in `getInvoiceItems()`

## 4. UI Components

- [x] 4.1 Add `dueDate` field to `invoice-form.tsx` (date input, placed after issue date)
- [x] 4.2 Add `paidAmount` field to `invoice-form.tsx` via `MoneyInput`, shown only when creating a new invoice
- [x] 4.3 Create `record-payment-form.tsx` in `components/sales/` — form with amount (pre-filled with remaining balance), date, method, reference, notes fields
- [x] 4.4 Create `payment-history-content.tsx` in `components/sales/` — owns fetching and rendering of payments for an invoice
- [x] 4.5 Extract shared `Dialog` shell into `components/common/dialog.tsx`; both invoice dialogs and payment dialogs compose this shell with their content components (no per-dialog wrapper components)
- [x] 4.6 Create `status-badge.tsx` component in `components/sales/` — color-coded badge with translated labels (`sales.statuses.*`)
- [x] 4.7 Add "Due Date" and "Outstanding" columns to the invoices table in `sales-list-view.tsx`
- [x] 4.8 Extract `sales-action-menu.tsx` in `components/sales/` with actions: View Payments, Send Invoice, Record Payment, Cancel Invoice, Reopen Invoice, Edit, Delete — each guarded by permissions and with icons
- [x] 4.9 Update `invoice-item.tsx` and `activity-timeline.tsx` in `components/clients/` to use the shared `Dialog` + `InvoiceForm` and display status/due date/outstanding
- [x] 4.10 Add translations (`en.json` / `es.json`) for statuses, send invoice, view payments, reopen invoice, record payment, and amount paid

## 5. Permissions

- [x] 5.1 Add `sales:record-payment` to the permissions seed data
- [x] 5.2 Guard menu actions: view payments / record payment require `sales:record-payment`; send, cancel, reopen, edit require `sales:edit`

## 6. Data Migration

- [x] 6.1 Run a data migration to set `paidAmount = grandTotal` for existing invoices with status "paid"
- [x] 6.2 Backfill a payment record for every existing invoice with `paidAmount > 0` that had no payment rows (amount = paid amount, date = issue date)
- [x] 6.3 Reconcile `ALSIA-KO4WQ2IX` (paid amount exceeded grand total by 200) — paid amount and payment record corrected to grand total
- [x] 6.4 Verify all invoices with a paid amount now have payment history; remove the one-off data migration script
