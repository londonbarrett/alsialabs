## 1. Navigation & i18n

- [x] 1.1 Add `myInvoices` item to `navigationSection()` in `config/sidebar-menu.ts` above `myTasks` using `Receipt` icon, no `requiredPermission`, url `/dashboard/my-invoices`
- [x] 1.2 Add `sidebar.myInvoices` and `breadcrumb.myInvoices` plus `myInvoices.*` keys (title, subtitle, noInvoices, noClient, invoiceHash, client, type, date, dueDate, total, paidAmount, outstanding, status, actions, noPayments, noItems) to `messages/en.json` and `messages/es.json`
- [x] 1.3 Verify `components/common/app-sidebar.tsx` active state works for `/dashboard/my-invoices` and subroutes (relies on existing `pathname.startsWith`)

## 2. Server actions for own invoices

- [x] 2.1 Add `getMyInvoices()` to `lib/actions/invoices.ts` — uses `auth()` + `getEffectiveStoreId()` + `clientsTable.userId` lookup, store-scoped invoice select ordered by `issueDate desc`, derives `overdue` like `lib/actions/sales.ts:99`, returns `{success, data}` or empty if no client
- [x] 2.2 Add `getMyInvoiceDetails(invoiceId)` (or `getMyInvoiceItems`/`getMyInvoicePayments`) to `lib/actions/invoices.ts` — ownership check via linked client, returns invoice + items + payments ordered by `paymentDate desc`
- [x] 2.3 Add `unwrap`/error handling parity with `getClientInvoices` but without `requirePermission` gate

## 3. Route shell

- [x] 3.1 Create `app/dashboard/my-invoices/page.tsx` — server component: `requireAuth` check (redirect `/login`), fetch linked client via `getClientByUserId`, call `getMyInvoices`, render `MyInvoicesView` with header + empty states
- [x] 3.2 Create `app/dashboard/my-invoices/loading.tsx` skeleton (header + two filter/table placeholders) matching `app/dashboard/my-tasks/loading.tsx`
- [x] 3.3 Ensure `components/dashboard-breadcrumb.tsx` displays `breadcrumb.myInvoices` via `t.has(segment)` (no code change if key exists)

## 4. UI components

- [x] 4.1 Create `components/my-invoices/my-invoices-view.tsx` — header (`PageHeader` + `Receipt`), list wrapper, handles client-not-linked vs empty vs populated
- [x] 4.2 Create `components/my-invoices/my-invoices-list.tsx` — table with columns invoice number, type, issue/due date, status (`StatusBadge`), grand total, paid/outstanding; expand row or dialog to show line items (qty, unitPrice, disc/tax%, total) and payment history (date, amount, method, reference, notes)
- [x] 4.3 Reuse `computeInvoiceTotals` formatting and `StatusBadge`; ensure currency formatting via `toLocaleString` and semantic tokens

## 5. Verification

- [x] 5.1 Run `pnpm build` and spot-check sidebar order, active highlight, mobile overlay close, collapsed icon, store switcher isolation
- [x] 5.2 Manual check: linked client sees own invoices only; unlinked user sees empty state; staff can still access `/dashboard/sales` for all invoices; profile timeline still shows invoices
- [ ] 5.3 Add or update Playwright e2e for sidebar `myInvoices` visibility and `/dashboard/my-invoices` page load
