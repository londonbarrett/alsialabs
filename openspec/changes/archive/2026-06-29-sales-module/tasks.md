## 1. Database Schema & Seed

- [x] 1.1 Add `invoice` table to Drizzle schema (id, type, invoice_number, client_id, status, issue_date, notes, subtotal, discount_total, tax_total, grand_total, created_at, updated_at)
- [x] 1.2 Add `invoice_item` table to Drizzle schema (id, invoice_id, description, quantity, unit_price, discount_percent, tax_percent, total, product_id)
- [x] 1.3 Add `invoice_sequence` table for atomic global sequential invoice numbering
- [x] 1.4 Add sales module permissions to seed script
- [x] 1.5 Generate and run Drizzle migration

## 2. Server Actions

- [x] 2.1 Create `lib/actions/sales.ts` with `getInvoices` action (list with client + items)
- [x] 2.2 Create `upsertInvoice` action with Zod validation, permission check, total recalculation, and atomic invoice number generation
- [x] 2.3 Create `deleteInvoice` action with permission check and cascade delete
- [x] 2.4 Generate invoice number via short UUID (`INV-${crypto.randomUUID().slice(0, 8)}`) — removed sequential sequence table
- [x] 2.5 Add permission guards (requirePermission) to each action

## 3. Sidebar & Navigation

- [x] 3.1 Update sidebar menu config to point Sales to `/dashboard/sales` with sales:view permission check
- [x] 3.2 Create `app/dashboard/sales/page.tsx` server component with auth check and data fetch

## 4. Sales UI

- [x] 4.1 Create `SalesListView` component with invoice table and empty state
- [x] 4.2 Create `SalesDialog` component wrapping the dialog
- [x] 4.3 Create `SalesForm` component with client picker, type toggle, line items table with add/remove rows, auto-calculated totals
- [x] 4.4 Create `ActionMenu` component for invoice rows (view/edit/delete)
- [x] 4.5 Wire up sales page with permissions

## 5. E2E Tests

- [x] 5.1 Create `e2e/sales.spec.ts` with tests for viewing sales, creating/editing/deleting invoices, product vs service type, add/remove line items
