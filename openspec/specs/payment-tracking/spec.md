## ADDED Requirements

### Requirement: User can record a payment against an invoice
The system SHALL allow authenticated users with `sales:record-payment` permission to record a payment against any invoice. The payment amount SHALL update the invoice's paid amount, and the invoice status SHALL automatically update based on the outstanding balance.

#### Scenario: Record full payment
- **WHEN** a user with `sales:record-payment` permission opens the record payment dialog for an invoice
- **THEN** they see fields: amount (pre-filled with remaining balance), payment date, method (optional), reference (optional), notes (optional)
- **WHEN** the user submits a valid payment with amount equal to the remaining balance
- **THEN** the invoice status becomes "paid"
- **AND** the invoice's paid amount equals the grand total
- **AND** a success toast is shown

#### Scenario: Record partial payment
- **WHEN** a user records a payment with amount less than the remaining balance
- **THEN** the invoice status becomes "partially_paid"
- **AND** the paid amount is updated to reflect the partial payment

#### Scenario: Multiple payments
- **WHEN** multiple payments are recorded against the same invoice
- **THEN** the paid amount is the sum of all recorded payments
- **AND** when the cumulative paid amount reaches the grand total, the status becomes "paid"

#### Scenario: Payment amount exceeds remaining balance
- **WHEN** a user submits a payment with amount greater than the remaining balance
- **THEN** the system rejects with a validation error
- **AND** no payment is recorded

#### Scenario: Unauthenticated payment recording rejected
- **WHEN** an unauthenticated user attempts to record a payment
- **THEN** the action returns an unauthorized error
- **AND** no payment is recorded

#### Scenario: Unauthorized payment recording rejected
- **WHEN** a user without `sales:record-payment` permission calls the record payment action
- **THEN** the action returns an error
- **AND** no payment is recorded

### Requirement: User can view payment history for an invoice
The system SHALL display a list of payments recorded against an invoice, accessible from the invoice row in the sales table.

#### Scenario: View payments from invoice row
- **WHEN** a user with `sales:view` permission clicks "View Payments" on an invoice row
- **THEN** a dialog or panel shows all payments for that invoice
- **AND** each payment shows: amount, date, method, reference, and notes (when present)

#### Scenario: Empty payment history
- **WHEN** an invoice has no payments recorded
- **THEN** the payments view shows an empty state message

#### Scenario: Payment action menu labels include the amount
- **WHEN** a user with `sales:record-payment` permission opens the action menu on a payment row
- **THEN** the menu shows "Edit {amount}" and "Delete {amount}" items (e.g., "Edit $50,000.00", "Delete $50,000.00")

#### Scenario: Payment actions hidden without permission
- **WHEN** a user without `sales:record-payment` permission opens the payment history dialog
- **THEN** no edit or delete actions are shown on payment rows

### Requirement: User can edit a payment
The system SHALL allow authenticated users with `sales:record-payment` permission to edit a payment's amount, payment date, method, reference, and notes from the payment history dialog.

#### Scenario: Successful payment edit
- **WHEN** a user with `sales:record-payment` permission clicks "Edit {amount}" on a payment row
- **THEN** a pre-filled dialog form appears with the payment's current values
- **WHEN** the user modifies fields and submits
- **THEN** the payment is updated
- **AND** the invoice's paid amount and status are recalculated
- **AND** a success toast is shown

#### Scenario: Edited payment would exceed the invoice total
- **WHEN** a user edits a payment amount so that the sum of all payments exceeds the invoice grand total
- **THEN** the edit is rejected
- **AND** no payment is modified

#### Scenario: Editing a payment re-syncs invoice status
- **WHEN** the last payment of a fully paid invoice is reduced below the grand total
- **THEN** the invoice status changes to "partially_paid" or "draft" accordingly

#### Scenario: Unauthorized payment edit rejected
- **WHEN** a user without `sales:record-payment` permission calls the update payment action
- **THEN** the action returns an error
- **AND** no payment is modified

### Requirement: User can delete a payment
The system SHALL allow authenticated users with `sales:record-payment` permission to delete a payment after confirmation.

#### Scenario: Successful payment deletion
- **WHEN** a user with `sales:record-payment` permission clicks "Delete {amount}" on a payment row
- **THEN** a confirmation dialog appears
- **WHEN** the user confirms
- **THEN** the payment is removed
- **AND** the invoice's paid amount and status are recalculated
- **AND** a success toast is shown

#### Scenario: Deleting a payment re-syncs invoice status
- **WHEN** a payment is deleted from a partially paid invoice such that no payments remain
- **THEN** the invoice status returns to "draft" (or "overdue" past the due date)
- **AND** the paid amount becomes 0

#### Scenario: Unauthorized payment deletion rejected
- **WHEN** a user without `sales:record-payment` permission calls the delete payment action
- **THEN** the action returns an error
- **AND** no payment is deleted

### Requirement: Invoice status is automatically determined
The system SHALL compute the invoice status based on due date, paid amount, and grand total, with manual control for draft, sent, and cancelled states.

#### Scenario: New invoice starts as draft
- **WHEN** an invoice is created with no amount paid
- **THEN** its initial status is "draft"
- **AND** the paid amount is 0

#### Scenario: New invoice created with a paid amount
- **WHEN** an invoice is created with an amount paid
- **THEN** a payment record is created for that amount
- **AND** the invoice status is "paid" when the amount covers the grand total, or "partially_paid" when it covers part of it

#### Scenario: Invoice marked as sent
- **WHEN** a user marks a draft invoice as sent
- **THEN** its status becomes "sent"

#### Scenario: Invoice auto-paid on full payment
- **WHEN** a payment brings the paid amount to equal the grand total
- **THEN** the invoice status becomes "paid"

#### Scenario: Invoice auto-partially-paid on partial payment
- **WHEN** a payment brings paid amount above 0 but below grand total
- **THEN** the invoice status becomes "partially_paid"

#### Scenario: Invoice auto-overdue past due date
- **WHEN** the current date is past the invoice due date
- **AND** the paid amount is less than the grand total
- **AND** the invoice is not cancelled
- **THEN** the invoice status is shown as "overdue"

#### Scenario: Invoice cancelled manually
- **WHEN** a user with `sales:edit` permission cancels an invoice
- **THEN** the invoice status becomes "cancelled"
- **AND** no further payments can be recorded against it

#### Scenario: Cancelled invoice reopened
- **WHEN** a user with `sales:edit` permission reopens a cancelled invoice
- **THEN** the invoice status becomes "draft"
- **AND** the invoice can be sent or paid again

### Requirement: Invoice status badges are color-coded
The system SHALL display invoice status with distinct color coding in the invoices table and activity timeline.

#### Scenario: Status badge colors
- **WHEN** viewing the invoices table
- **THEN** paid invoices show a green badge
- **AND** partially paid invoices show a blue badge
- **AND** overdue invoices show a red badge
- **AND** sent invoices show an amber badge
- **AND** draft invoices show a gray badge
- **AND** cancelled invoices show a muted slate badge

### Requirement: Invoices table includes due date and outstanding balance columns
The system SHALL display due date and outstanding balance columns in the invoices table on the sales page.

#### Scenario: Due date column visible
- **WHEN** a user with `sales:view` permission navigates to the sales page
- **THEN** the invoices table includes a "Due Date" column
- **AND** an "Outstanding" column showing the remaining balance (grand total minus paid amount)

#### Scenario: Paid invoice shows zero outstanding
- **WHEN** an invoice has been fully paid
- **THEN** the outstanding balance column shows $0.00
