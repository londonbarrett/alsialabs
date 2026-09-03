## Context

Current invoice visibility is split: staff use `/dashboard/sales` (requires `sales:view`) for global invoices; linked clients see a mixed timeline (`ActivityTimeline` on `/dashboard/profile`) that requires `client-activity:view` to show invoices. There is no standalone client-facing invoice page. Staff who are also linked clients have the same profile timeline, but no focused view. The sidebar's Navigation section (`config/sidebar-menu.ts:107`) already groups user-facing items (Profile, Projects, My Tasks, Calendar) and is permission-agnostic for Profile.

Constraints: no DB migration; reuse `invoice`/`invoice_item`/`invoice_payment`; respect `store_id` scoping via `getEffectiveStoreId()`; keep profile timeline unchanged; do not add permission gates for the new page (per product decision).

## Goals / Non-Goals

**Goals:**
- Add "My Invoices" nav item above My Tasks, visible to everyone, with correct active state and translations.
- Provide `/dashboard/my-invoices` page that resolves the linked client (`clients.userId = session.user.id`) store-scoped and lists that client's invoices sorted by issue date desc, with status derivation (`overdue`) and decoded totals.
- Support read-only view of line items and payment history per invoice (expand/dialog pattern), reusing existing UI primitives.
- Keep behavior deterministic for unlinked users and empty states, with no forbidden errors.

**Non-Goals:**
- No invoice creation/edit/payment mutation on this page (read-only).
- No pagination/filtering beyond simple list (status filter deferred).
- No PDF export or download.
- No changes to `/dashboard/profile` or `/dashboard/sales`.

## Decisions

**1. Navigation placement & gating**
- Insert `myInvoices` into `navigationSection()` before `myTasks` in `config/sidebar-menu.ts`. No `requiredPermission`. Rationale: matches Profile pattern (`dashboard-navigation/spec.md:103`); product wants everyone to see it. Alternative considered: gate on `sales:view-invoice-history` — rejected because clients lack it per `client-invoice-history/spec.md:6` and would hide the feature from its primary audience.

**2. Data access**
- Add `getMyInvoices()` (and `getMyInvoiceDetails(invoiceId)`) to `lib/actions/invoices.ts` using `auth()` + `getEffectiveStoreId()` + `clientsTable.userId` lookup. No `requirePermission`. Rationale: reuses existing ownership check (`invoices.ts:51`) but drops permission requirement; store-scoped to avoid cross-store leakage (same pattern as `lib/actions/sales.ts:92`). Alternative: reuse `getClientInvoices` — rejected due to permission gate.
- Derive `overdue` like `lib/actions/sales.ts:99` (compare `dueDate < today` when `status not in (paid,cancelled,draft)` and `paidAmount < grandTotal`). Return `Invoice & { outstandingBalance }` for UI.

**3. Route auth**
- `app/dashboard/my-invoices/page.tsx` mirrors `app/dashboard/my-tasks/page.tsx:8` minimal guard: `if (!session?.user) redirect("/login")`. No `hasPermission` check. Fetches `client` via `getClientByUserId` (store-scoped) and then `getMyInvoices()`. If `client == null`, renders empty state without querying invoices.

**4. UI composition**
- New `components/my-invoices/my-invoices-view.tsx` (header via `PageHeader` + `Receipt` icon) and `my-invoices-list.tsx` (table using `Table` + `StatusBadge` + `Badge` for totals, expand row for items/payments). Reuse `computeInvoiceTotals` not needed; display `grandTotal`/`paidAmount`/`outstanding`. Payment history reuses `PaymentItem` styling or inline table.
- Fetch items/payments lazily per invoice on expand via `getMyInvoiceDetails` to avoid N+1 on initial load (initial list only needs invoice headers). Alternative: eager join — deferred to keep initial query light.

**5. i18n**
- Keys: `sidebar.myInvoices`, `breadcrumb.myInvoices`, `myInvoices.title/subtitle/noInvoices/noClient/noInvoicesDesc/invoiceHash/status/...` to avoid colliding with `sales.*`.

## Risks / Trade-offs

- **Unlinked staff sees empty state** → Mitigation: subtitle explains linking via client record; sales page remains source for global view. No forbidden to avoid confusion.
- **Permission-less data access must still enforce ownership** → Mitigation: ownership check `clients.userId = session.user.id` + store scoping; return empty if not owner.
- **Stale overdue derivation** → Mitigation: compute on read like Sales; no cron needed.
- **Profile duplication** → Keeping profile timeline means two invoice surfaces; mitigate by clearly labeling "My Invoices" as dedicated list, profile remains composite.
- **i18n drift** → Add both EN/ES keys together; fallback to key name visible in breadcrumb if missing.

## Migration Plan

- Deploy is additive; no migration.
- Rollback: remove sidebar item and route; no data loss.
- Verification: `pnpm build`, nav highlights, mobile close behavior, store-switcher isolation, empty/populated states, expand items/payments.

## Open Questions

- Future filter (status/date) and pagination — out of scope now; table component designed to accept them later.
- Whether to cache `getMyInvoices` with `unstable_cache` + `invoice` tag — deferred (list is user-scoped and small).
