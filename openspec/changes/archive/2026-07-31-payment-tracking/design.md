## Context

Invoices currently have a single `status` field defaulting to "paid" with no concept of due dates, partial payments, or overdue detection. When an invoice is created via `upsertInvoice()`, it's immediately marked "paid" regardless of actual payment state. There is no `payments` table — the only record of an invoice's financial state is the `grandTotal` column.

The sales page shows invoices in a table with a "Status" column, and the client activity timeline shows invoices with color-coded status badges (paid=green, pending=amber, cancelled=red). However, since status is always "paid", the badges are purely decorative.

## Goals / Non-Goals

**Goals:**
- Track whether an invoice has been paid, is partially paid, or is overdue
- Allow users to record individual payment transactions against an invoice
- Show accurate, color-coded status badges in the invoices table and activity timeline
- Auto-detect overdue invoices based on due date and outstanding balance
- Include due date in the invoice create/edit form, and allow entering an amount paid at creation time
- Support the full invoice lifecycle: draft → sent → paid / partially_paid / overdue / cancelled, with cancelled invoices reopenable

**Non-Goals:**
- Payment gateway integration (Stripe, PayPal, etc.) — offline/manual payment recording only
- Automatic payment reconciliation or bank feed imports
- Emailing invoices or PDF generation — the "Send Invoice" action only flips the status to `sent`
- Payment method management or saved payment methods
- Refunds or credits against payments
- Payment receipts or PDF generation for payments

## Decisions

### 1. Separate `invoice_payment` table vs `paidAmount` column on invoice

**Decision**: Create an `invoice_payment` table with individual payment records and cache `paidAmount` on the `invoice` row.

**Rationale**: A separate table enables proper accounting — multiple payments per invoice, audit trail (who recorded what when), payment date tracking, and future extensibility (payment method, reference number). The cached `paidAmount` avoids expensive aggregation queries for listing invoices.

**Alternatives considered**:
- *`paidAmount` column only*: No audit trail, no multi-payment support, harder to correct mistakes. Rejected.
- *Full aggregation at query time*: Works but adds overhead to every invoice list query. Chose cached + recalculation to balance accuracy and performance.

### 2. Status lifecycle and computation

**Decision**: Status is computed from `dueDate`, `paidAmount`, and `grandTotal` rather than being set manually. Users set the status to `draft` or `sent` explicitly. The system computes `paid`, `partially_paid`, and `overdue`. `cancelled` is explicitly set.

Status transitions:
- `draft` → `sent` (user explicitly marks as sent)
- `sent` → `paid` / `partially_paid` (auto when payment recorded)
- `sent` / `partially_paid` → `overdue` (auto if past due date with balance > 0)
- Any → `cancelled` (user explicitly cancels)
- `cancelled` → `draft` (user explicitly reopens a cancelled invoice)

**Rationale**: This eliminates data inconsistency where status doesn't match actual payment state. The overdue status is always current since it's computed on read. Cancelled invoices are reopenable so mistakes can be corrected without deleting history.

**Alternatives considered**:
- *Fully manual status*: Prone to human error (forgetting to update). Rejected.
- *Fully automatic lifecycle*: Too restrictive — users need draft/sent/cancelled control. Adopted hybrid.
- *Cancelled as terminal state*: Forced deletion/recreation to fix a wrong cancellation. Rejected in favor of reopen.

### 3. Overdue detection approach

**Decision**: Compute overdue status dynamically in `getInvoices()` by comparing `dueDate < today` AND `paidAmount < grandTotal`. No background job needed.

**Rationale**: Simple, always accurate, no staleness. The computation is cheap (a comparison and subtraction per row).

### 4. Permissions

**Decision**: Add `sales:record-payment` permission scoped to recording payments. Viewing payment history uses existing `sales:view`.

**Rationale**: Recording payments is a financial action that deserves explicit permission control, separate from invoice create/edit.

### 5. Database fields

**`invoicesTable` additions:**
- `dueDate: date("due_date")` — nullable, no default
- `paidAmount: decimal("paid_amount", { precision: 12, scale: 2 })` — default `"0"`, not null

**`invoicePaymentsTable` (table: `"invoice_payment"`) columns:**
- `id: text` — UUID primary key
- `invoiceId: text("invoice_id")` — FK to invoices, cascade delete
- `amount: decimal({ precision: 12, scale: 2 })` — not null
- `paymentDate: date("payment_date")` — not null
- `method: text` — nullable, free-text (e.g., "cash", "transfer", "check")
- `reference: text` — nullable, free-text (e.g., check number, transaction ID)
- `notes: text` — nullable
- `createdAt: timestamp("created_at")` — default now
- `userId: text("user_id")` — FK to users, set null on delete

### 6. Status badge color scheme

| Status | Color |
|---|---|
| `paid` | Green (emerald) |
| `partially_paid` | Blue (sky) |
| `overdue` | Red (rose/destructive) |
| `sent` | Amber (amber) |
| `draft` | Gray (muted) |
| `cancelled` | Slate (muted, strikethrough) |

### 7. Amount paid at invoice creation

**Decision**: When creating an invoice, the user may enter an amount paid up front. The invoice's initial status is derived from it (`paid` if it covers the grand total, `partially_paid` if it covers some, otherwise `draft`), and a matching `invoice_payment` row is inserted so payment history stays consistent. The field is not shown when editing — edits do not change `paidAmount`.

**Rationale**: Many invoices are settled at the point of sale. Entering the amount once avoids a separate record-payment step while keeping the payment ledger complete and the status accurate.

## Risks / Trade-offs

- **[Data migration]** Existing invoices all have status "paid" but no payment records. After migration, `paidAmount` was backfilled to equal `grandTotal`, and a payment record was created for every invoice with a paid amount (using the issue date as payment date). The one-off script was run and then removed. → Covered by data migration, now complete.
- **[Performance]** The overdue computation adds a WHERE clause to the main invoice query. Negligible at current scale but should be monitored. → Add an index on `due_date`.
- **[Race condition]** Two users recording payments simultaneously could lead to stale `paidAmount`. → Since this is a single-server Next.js app with serialized DB writes, the risk is minimal. Use a transaction if it becomes an issue.
- **[Backwards compatibility]** The `Invoice` type grows new fields; existing code referencing `invoice.status` will still work (return new values). Components rendering status badges may need updates. → Covered in tasks.
