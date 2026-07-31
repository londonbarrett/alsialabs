## Why

Invoices currently default to "paid" status with no tracking of due dates, partial payments, or overdue detection. Users need to track whether invoices have been paid, are overdue, or have only been partially paid.

## What Changes

- **Add `due_date` column** to the invoice table
- **Expand invoice statuses** from a single "paid" default to: `draft`, `sent`, `paid`, `partially_paid`, `overdue`, `cancelled`
- **Add `paid_amount` column** to track how much has been paid against an invoice
- **Add `invoice_payment` table** to record individual payment transactions against invoices
- **Update invoice form** to include due date and an amount-paid field on creation
- **Update invoice table/list** to show proper status badges with color coding, plus due date and outstanding columns
- **Add payment recording UI** — ability to record a payment against an invoice
- **Add payment history view** — list payments recorded per invoice
- **Add invoice lifecycle actions** — send (draft → sent), cancel (→ cancelled), reopen (cancelled → draft)
- **Overdue detection** — invoices past due date with outstanding balance auto-flagged as overdue

## Capabilities

### New Capabilities
- `payment-tracking`: Payment recording, status tracking, overdue detection, and partial payment support for invoices

### Modified Capabilities
- `sales`: Invoice status semantics change from single-state to payment-aware lifecycle; due date added to invoice form; invoices table shows payment status badges

## Impact

- **Schema**: Add `dueDate`, `paidAmount` to `invoicesTable`; create new `invoicePaymentsTable`; generate Drizzle migration
- **Server actions**: New `recordPayment()`, `cancelInvoice()`, `markInvoiceAsSent()`, `reopenInvoice()`, `getInvoicePayments()` actions; update `upsertInvoice()` for due date, paid amount and initial status; update `getInvoices()` to compute overdue status and outstanding balance
- **Components**: Update `invoice-form.tsx` (due date + amount paid), `sales-list-view.tsx` (status badges, due date/outstanding columns, action menu), `invoice-item.tsx` / `activity-timeline.tsx` (status styling); new `record-payment-form.tsx`, `payment-history-content.tsx`, `sales-action-menu.tsx`, `status-badge.tsx`; shared `Dialog` shell in `components/common/dialog.tsx`
- **Permissions**: Add `sales:record-payment` permission for recording payments
- **Models**: New `InvoicePayment` type; updated `Invoice` type with `dueDate` and `paidAmount`
- **Data migration**: Backfill `paidAmount` and payment records for existing paid invoices
