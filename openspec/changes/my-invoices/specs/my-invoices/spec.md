## ADDED Requirements

### Requirement: My Invoices page
The system SHALL provide a "My Invoices" page at `/dashboard/my-invoices` accessible to any authenticated user (no permission required). It SHALL resolve the client linked to the current user (`clients.userId = session.user.id` scoped to the effective store) and display that client's invoices. The page SHALL remain visible even when no client is linked, showing an empty state instead of a forbidden error.

#### Scenario: Authenticated user navigates to My Invoices
- **WHEN** an authenticated user navigates to `/dashboard/my-invoices`
- **THEN** the page renders with a header (title, subtitle, Receipt icon) and the user's own invoices

#### Scenario: Unauthenticated user redirected
- **GIVEN** a user is not authenticated
- **WHEN** they navigate to `/dashboard/my-invoices`
- **THEN** they are redirected to `/login`

#### Scenario: No linked client shows empty state
- **GIVEN** an authenticated user has no linked client record for the effective store
- **WHEN** they visit `/dashboard/my-invoices`
- **THEN** they see an empty state indicating no client is linked / no invoices

### Requirement: My Invoices lists own invoices
The system SHALL list only invoices where `invoice.clientId` matches the linked client's id for the effective store, ordered by `issueDate` descending. The list SHALL show invoice number, issue date, due date, status (with overdue derivation), grand total, paid amount/outstanding, and type. Invoices SHALL be derived as `overdue` when `dueDate < today` and `status not in (paid, cancelled, draft)` and `paidAmount < grandTotal`.

#### Scenario: Client views own invoices sorted
- **GIVEN** a linked client has multiple invoices
- **WHEN** they view `/dashboard/my-invoices`
- **THEN** they see their invoices sorted by issue date descending

#### Scenario: Only own invoices are shown
- **GIVEN** other clients have invoices in the same store
- **WHEN** the linked client views `/dashboard/my-invoices`
- **THEN** only their own invoices are shown

#### Scenario: Overdue status derived
- **GIVEN** an invoice has a past due date and is not paid/cancelled/draft with outstanding balance
- **WHEN** it is displayed on My Invoices
- **THEN** its status is shown as "overdue"

### Requirement: My Invoices shows line items and payment history
The system SHALL allow the user to view line items and payment history for each invoice. Line items SHALL show description, quantity, unit price, discount/tax percents, and total. Payments SHALL show payment date, amount, method, reference, and notes, ordered by payment date descending.

#### Scenario: View invoice line items
- **GIVEN** an invoice has line items
- **WHEN** the user expands or opens that invoice on My Invoices
- **THEN** they see all line items with their totals

#### Scenario: View payment history
- **GIVEN** an invoice has payments
- **WHEN** the user expands or opens that invoice
- **THEN** they see payment history ordered by payment date descending
- **AND** they see paid vs outstanding summary

#### Scenario: No items or payments empty states
- **WHEN** an invoice has no payments
- **THEN** the payment section shows a "no payments" empty state

### Requirement: My Invoices keeps profile invoices
The system SHALL continue to show invoices on the profile page (`/dashboard/profile`) via the existing timeline, independent of the My Invoices page. No data or UI is removed from Profile.

#### Scenario: Profile still shows invoices
- **WHEN** a user views `/dashboard/profile` with a linked client and required data
- **THEN** the profile timeline still renders invoices and payments as before

### Requirement: Server action fetches own invoices without permission gate
The system SHALL provide a server action `getMyInvoices` that requires only authentication and client ownership (plus effective store scoping), with no permission check. It SHALL return invoices for the linked client or an empty list/error if no client is linked.

#### Scenario: Server action returns own invoices
- **GIVEN** an authenticated user with a linked client
- **WHEN** they call `getMyInvoices`
- **THEN** the action returns their invoices ordered by issue date descending

#### Scenario: Server action for unlinked user returns empty
- **GIVEN** an authenticated user with no linked client
- **WHEN** they call `getMyInvoices`
- **THEN** the action returns an empty list or a "no client" indicator without leaking other clients' data
