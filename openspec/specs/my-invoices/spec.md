# my-invoices Specification

## Purpose
TBD - created by archiving change my-invoices. Update Purpose after archive.
## Requirements
### Requirement: My Invoices page
The system SHALL provide a "My Invoices" page at `/dashboard/my-invoices` accessible to any authenticated user (no permission required). It SHALL resolve the client(s) linked to the current user via `clients.userId = session.user.id OR clients.email = session.user.email` (email fallback for legacy) and display that clients' invoices. The page SHALL remain visible even when no client is linked, showing an empty state instead of a forbidden error. The page SHALL use `Page` (`components/common/page.tsx`) as `@container` with `header` (`PageHeader` title/subtitle/Receipt) outside `Suspense` and content inside `Suspense` with a pulsing-rectangle fallback plus app `LoadingBar` via `LoadingDispatcher`.

#### Scenario: Authenticated user navigates to My Invoices
- **WHEN** an authenticated user navigates to `/dashboard/my-invoices`
- **THEN** the page renders with a header (title, subtitle, Receipt icon) and the user's own invoices
- **AND** the header is visible immediately while the list suspends

#### Scenario: Unauthenticated user redirected
- **GIVEN** a user is not authenticated
- **WHEN** they navigate to `/dashboard/my-invoices`
- **THEN** they are redirected to `/login`

#### Scenario: No linked client shows empty state
- **GIVEN** an authenticated user has no linked client record (by userId nor email)
- **WHEN** they visit `/dashboard/my-invoices`
- **THEN** they see an empty state indicating no client is linked / no invoices

#### Scenario: Page shows loading fallback and app indicator
- **WHEN** the invoices data is loading via `getMyInvoices`
- **THEN** the `Page` `Suspense` shows `LoadingDispatcher` (top `LoadingBar`) and a `h-96 animate-pulse rounded-xl border bg-muted/30` rectangle

### Requirement: My Invoices lists own invoices
The system SHALL list only invoices where `invoice.clientId` is in the set of client ids linked to the user (by userId or email), ordered by `issueDate` descending. The table SHALL show 5 columns: `invoiceHash` (invoiceNumber with caret icon), `date` (issueDate), `status` (with overdue derivation), `outstanding` (`grandTotal - paidAmount`), `total` (`grandTotal`), with no table border (`overflow-auto` only) and caret on the left as a plain `ChevronUp`/`ChevronDown` icon inline with the invoice number (no `Button` cell, no dedicated caret `TableHead`). Invoices SHALL be derived as `overdue` when `dueDate < today` and `status not in (paid, cancelled, draft)` and `paidAmount < grandTotal`. Empty list handling SHALL be in the parent view (`MyInvoicesView`), not in `MyInvoicesList`.

#### Scenario: Client views own invoices sorted
- **GIVEN** a linked client has multiple invoices
- **WHEN** they view `/dashboard/my-invoices`
- **THEN** they see their invoices sorted by issue date descending

#### Scenario: Only own invoices are shown
- **GIVEN** other clients have invoices in the same store
- **WHEN** the linked client views `/dashboard/my-invoices`
- **THEN** only their own invoices are shown (by userId/email set)

#### Scenario: Overdue status derived
- **GIVEN** an invoice has a past due date and is not paid/cancelled/draft with outstanding balance
- **WHEN** it is displayed on My Invoices
- **THEN** its status is shown as "overdue"

#### Scenario: Table has caret on left and no border
- **WHEN** the table renders
- **THEN** the first column shows a `ChevronDown`/`ChevronUp` `text-muted-foreground` icon inline with the invoice number (no `Button` cell)
- **AND** the table container has no `border` (`overflow-auto` only)

#### Scenario: Click row expands
- **WHEN** the user clicks anywhere on a row (cursor-pointer)
- **THEN** the row expands/collapses the details

### Requirement: My Invoices shows line items, payment history and details
The system SHALL allow the user to view invoice details, line items and payment history for each invoice via an expandable row. `MyInvoiceDetails` SHALL show `type`, `date` (issueDate), `dueDate`, `total`, `paidAmount`, `outstanding` in a `grid grid-cols-2 @[600px]:grid-cols-3` card. Line items SHALL show description, quantity (`formatQuantity` from `lib/util/money`), unit price, discount/tax percents, and total (`formatCurrency`). Payments SHALL show payment date (`formatISODate` via `parseISODate` + `Intl.DateTimeFormat`), amount, method, reference, ordered by payment date descending. Details SHALL be split into `MyInvoicesItemsTable` and `MyInvoicesPaymentsTable` and composed inside `MyInvoicesRow`/`InvoiceDetailsRow` with `Activity` `mode={expanded?"visible":"hidden"}` to keep mounted hidden, lazy-loading on first expand (if `details===null`) with app `useLoadingIndicator` (`startLoading`/`stopLoading`) plus inline `common.loading`.

#### Scenario: View invoice details
- **GIVEN** an invoice with type/dueDate/paid
- **WHEN** the user expands that invoice
- **THEN** they see a details card with 6 fields (type, issueDate, dueDate, total, paid, outstanding) above the tables

#### Scenario: View invoice line items
- **GIVEN** an invoice has line items
- **WHEN** the user expands that invoice (first time)
- **THEN** `getMyInvoiceDetails({invoiceId})` is called once and they see all line items with totals

#### Scenario: View payment history
- **GIVEN** an invoice has payments
- **WHEN** the user expands that invoice
- **THEN** they see payment history ordered by paymentDate descending

#### Scenario: Lazy load only on first expand and keep hidden
- **WHEN** a row is collapsed and then expanded again
- **THEN** `getMyInvoiceDetails` is not called again (cached `details`), and the row was kept mounted hidden via `Activity` (no remount reload)

#### Scenario: Responsive details layout via container queries
- **WHEN** the details are shown inside `Page` `@container`
- **THEN** the items/payments section uses `flex flex-col @[900px]:flex-row` and the details card uses container queries (`@[600px]:grid-cols-3`) relative to `Page`, not viewport (`lg:`)

### Requirement: My Invoices keeps profile invoices
The system SHALL continue to show invoices on the profile page (`/dashboard/profile`) via the existing timeline, independent of the My Invoices page. For `user` role, profile SHALL show own invoices/payments via `getMyInvoices`/`getMyPayments` without requiring `client-activity:view`, even when no client linked via `clients:view`.

#### Scenario: Profile still shows invoices for user
- **GIVEN** a `user` with a linked client (by userId or email) but without `client-activity:view`
- **WHEN** they view `/dashboard/profile`
- **THEN** the profile timeline still renders their invoices and payments via `getMyInvoices`/`getMyPayments`

#### Scenario: Profile with no linked client shows none
- **GIVEN** a `user` with no linked client
- **WHEN** they view `/dashboard/profile`
- **THEN** no invoices are shown but no error is thrown

### Requirement: Server actions are safe actions
The system SHALL provide safe actions `getMyInvoices`, `getMyPayments`, `getMyInvoiceDetails` via `sessionAction` (or `actionClient` with `auth` check) with `zod` schemas: `getMyInvoices`/`getMyPayments` use `z.void()` (callable as `getMyInvoices()` with no `{}`) and no permission `metadata`, `getMyInvoiceDetails` uses `z.object({invoiceId:z.uuid()})`. `getClientInvoices`/`getClientPayments` SHALL be `sessionAction` with `metadata({permission:{module:"client-activity",action:"view"}})` and `z.object({clientId:z.uuid()})`. All SHALL use `returnActionError` codes and be consumed via `use(invoicesPromise)` in `MyInvoicesView` and `result.data`/`unwrapResponse` in callers, with `formatCurrency`/`formatQuantity`/`formatISODate` utils.

#### Scenario: getMyInvoices callable without empty object
- **WHEN** a caller does `getMyInvoices()`
- **THEN** it succeeds without passing `{}` (via `z.void()`)

#### Scenario: getMyInvoices returns own invoices without permission
- **GIVEN** an authenticated user with a linked client (by userId or email)
- **WHEN** they call `getMyInvoices()`
- **THEN** the action returns `{clientId, invoices}` ordered by issueDate descending without permission check

#### Scenario: getMyInvoiceDetails returns items and payments
- **WHEN** they call `getMyInvoiceDetails({invoiceId})`
- **THEN** it returns `{invoice, items, payments}` after ownership check (`invoice.clientId` in user’s client set)

#### Scenario: Server action uses safe-action builder without empty metadata hack
- **WHEN** `getMyInvoices` is defined
- **THEN** it uses `sessionAction.inputSchema(z.void()).metadata({}).action` or `actionClient.use(...).inputSchema(z.void()).action` without `as any` and without empty `{}` param

### Requirement: Page container is reusable Page
The system SHALL provide `Page` (`components/common/page.tsx`) as `@container flex flex-1 flex-col gap-6 p-6` with `header` outside `Suspense` and `children` inside `Suspense` whose fallback shows `LoadingDispatcher` (app `LoadingBar`) plus an optional `fallback` prop (pulsing rectangle). `MyInvoicesView` SHALL be a client component using `use(invoicesPromise)` and delegating empty checks to the view (not the list), while `MyInvoicesList` is pure table and `MyInvoicesRow` handles `expanded` state, `Activity`, `useLoadingIndicator`, and row `onClick`.

#### Scenario: Page shows header immediately
- **GIVEN** the list is loading
- **WHEN** the page renders
- **THEN** `PageHeader` is visible outside `Suspense` while the list shows the pulsing fallback and top loading bar
