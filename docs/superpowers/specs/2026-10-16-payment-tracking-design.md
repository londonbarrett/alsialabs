# Payment tracking — Design

## Why this exists

Invoices are only as useful as their payment state. The capability records payments against invoices and lets the invoice's status follow the money automatically: a paid amount below the total means partially paid, reaching the total means paid, an unpaid invoice past its due date means overdue — while draft, sent, and cancelled remain under manual control. Status is derived, not hand-maintained, so the table can never disagree with the payments behind it.

Payment history is a list, and lists in this app are optimistic. Recording, editing, or deleting a payment patches the payment rows and the parent invoice's `paidAmount`/`status` in the same store pass, commits the server's authoritative result on success, and discards on failure — including validation failures, since the server recomputes totals and can reject an amount that would push the invoice over its grand total.

Payments are also edited from two routes: the sales page and the client timeline. The mutation surface is shared through action hooks per route, while the invoice re-sync logic lives server-side in one place so both routes converge on the same computed status.

## Goals

- Record, view, edit, and delete invoice payments behind `sales:create`/`view`/`edit`/`delete` permissions.
- Keep invoice `paidAmount` and status in sync with payments, without `router.refresh()`.
- Compute invoice status from due date, paid amount, and grand total, with manual draft/sent/cancelled control.
- Present payments and status clearly in the invoices table.

## Design

### Recording a payment

Any authenticated user with `sales:create` can record a payment against any invoice. The record payment dialog offers amount (pre-filled with the remaining balance), payment date, and optional method, reference, and notes. Submitting a valid payment closes the dialog immediately — `handleRecordPaymentSubmit` (`components/sales/invoices-card.tsx:53`) runs `setPaymentDialog((s) => ({ ...s, open: false }))` at `components/sales/invoices-card.tsx:57` and calls `recordPayment` from `usePaymentActions` (`stores/invoice/use-payment-actions.ts`) fire-and-forget — while the invoices table updates optimistically to the new `paid`/`paidAmount` through the `recordPayment` action of `salesReducer` (`stores/invoice/sales-reducer.ts`), committed on success and discarded on failure.

The server call is `recordPayment` (`actions/payments.ts:10`), a `sessionAction` validating against `PaymentSchema` (`actions/schemas/payment.ts:3`). Its `serverError` is toasted; its `validationErrors` revert the optimistic update. A payment equal to the remaining balance settles the invoice; a smaller amount moves it to `partially_paid`; multiple payments accumulate, and the cumulative paid amount reaching the grand total flips the status to `paid`. A payment exceeding the remaining balance is rejected with `VALIDATION_FAILED`, records nothing, and reverts the optimistic update. Unauthenticated callers get `UNAUTHORIZED` from the `sessionAction`, and callers without `sales:create` get `FORBIDDEN` (`actions/payments.ts:12`) — no payment is recorded in either case.

### Viewing payment history

`PaymentHistory` (`components/sales/payment-history.tsx`) is opened from "View Payments" on an invoice row by a user with `sales:view`, and shows every payment for that invoice fetched via `getInvoicePayments` (`actions/invoices.ts:460`, a `sessionAction` with `sales:view`) — each row displaying amount, date, method, reference, and notes. An invoice with no payments shows an empty-state message.

The component reads them from `getPayments` on `useInvoiceState()` (`stores/invoice/use-invoice-state.ts`) and loads them with `usePaymentActions().loadPayments`, stored through the `setPayments` case of `salesReducer`. The payment-row action menu labels include the amount — "Edit {amount}" and "Delete {amount}" — and the edit/delete actions are hidden entirely without permission: `canManage` checks `sales:edit`/`create`/`delete` at `components/sales/invoices-card.tsx:408`.

### Editing a payment

A user with `sales:edit` opens a pre-filled dialog from "Edit {amount}" and can change amount, payment date, method, reference, and notes. `PaymentHistory` and `PaymentItem` (`components/clients/payment-item.tsx`) close the dialog and delegate to `usePaymentActions().updatePayment` on the sales page or `useTimelineActions().updatePayment` (`stores/timeline/use-timeline-actions.ts`) on the timeline — either way the store patches optimistically, covering both the payment and its parent invoice's `paidAmount`/`status` in one `salesReducer` pass. The server call is `updatePayment` (`actions/payments.ts:123`, `sales:edit`, `PaymentSchema`); a caller without `sales:edit` gets `FORBIDDEN` (`actions/payments.ts:125`) and no payment is modified.

The invariant on edits is that the payment sum can never exceed the invoice grand total: an edit that would push the sum over is rejected with `VALIDATION_FAILED` and the optimistic update is reverted. Reductions flow the other way — when the last payment of a fully paid invoice is reduced below the total, `syncInvoicePaymentState` (`actions/payments.ts:76`) recomputes `paidAmount`/`status` via `sum(amount)`, and `InvoicesCard` (`components/sales/invoices-card.tsx`) reflects it without a `router.refresh`, because the reducer patched the payment list and the parent invoice in the same pass.

### Deleting a payment

Deletion requires `sales:delete` and a confirmation. On confirm, `PaymentHistory`/`PaymentItem` call `deletePayment` from `usePaymentActions` (sales page) or `useTimelineActions` (timeline) fire-and-forget: the row disappears and the parent invoice patches optimistically through `salesReducer`, with the server call at `deletePayment` (`actions/payments.ts:199`); a caller without `sales:delete` gets `FORBIDDEN` (`actions/payments.ts:201`) and nothing is deleted.

As with edits, `syncInvoicePaymentState` recomputes the invoice's `paidAmount`/`status`, and the invoice table reflects it without a `router.refresh`. Deleting the last payment on a partially paid invoice returns the status to `draft` — or `overdue` if the due date has passed.

### Automatic invoice status

Status is computed from due date, paid amount, and grand total, with three states under manual control:

- A new invoice starts as `draft` with paid amount 0. Creating one with an amount paid creates a payment record for it and lands on `paid` (amount covers the total) or `partially_paid` (part of it).
- A user marks a draft `sent`. A user with `sales:edit` cancels an invoice to `cancelled`, which blocks any further payments against it; reopening a cancelled invoice returns it to `draft`, from where it can be sent or paid again.
- Automatically: a payment bringing paid to the grand total makes it `paid`; a payment above 0 but below the total makes it `partially_paid`; past the due date with paid below the total and not cancelled, it shows `overdue`.

### Status badges

Status is color-coded everywhere it appears — the invoices table and the activity timeline: paid green, partially paid blue, overdue red, sent amber, draft gray, cancelled muted slate.

### Invoices table columns

The invoices table on the sales page carries a "Due Date" column and an "Outstanding" column showing the remaining balance, grand total minus paid amount — visible to any user with `sales:view`, and showing `$0.00` once an invoice is fully paid.

## Non-goals

- Manual entry of invoice status derived from money — `paid`, `partially_paid`, and `overdue` are computed; only `draft`, `sent`, and `cancelled` are set by hand.
- Payments against cancelled invoices. Cancellation blocks further recording.
- `router.refresh()` to update invoice rows after payment changes. The reducer patches payment list and parent invoice together.
- Per-payment currency or split logic beyond the sum-vs-total rule. The paid amount is simply the sum of recorded payments.
- Payment permissions beyond the `sales:*` set — recording is gated by `sales:create`, viewing by `sales:view`, editing by `sales:edit`, deletion by `sales:delete`.
