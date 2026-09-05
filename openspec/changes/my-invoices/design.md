## Context

Current invoice visibility is split: staff use `/dashboard/sales` (`sales:view`) for global invoices; linked clients see a mixed timeline (`ActivityTimeline` on `/dashboard/profile`) that requires `client-activity:view` (which `user` lacks) and `clients:view` for `getClientByUserId`. There is no standalone client-facing invoice page. Staff who are also linked clients have same profile timeline, but no focused view. Sidebar Navigation (`config/sidebar-menu.ts:107`) groups user-facing items and is permission-agnostic for Profile.

Constraints: no DB migration; reuse `invoice`/`invoice_item`/`invoice_payment`; keep profile timeline; new page must be permission-less and handle legacy `clients.email` fallback.

## Goals / Non-Goals

**Goals:**
- Add "My Invoices" nav item above My Tasks, visible to everyone, with `Page` as `@container`.
- Provide `/dashboard/my-invoices` page that resolves the linked client(s) via `userId OR email` (legacy fallback) and lists invoices sorted `issueDate desc` with `overdue` derivation, in a 5-column table (caret icon left, no border, row click to expand).
- Expanded row shows `MyInvoiceDetails` (6 fields: type, issueDate, dueDate, total, paid, outstanding — no invoiceNumber/status) plus `MyInvoicesItemsTable`/`MyInvoicesPaymentsTable` via `Activity` hidden, lazy on first expand with `useLoadingIndicator`, container-query responsive (`@[900px]:flex-row`, `@[600px]:grid-cols-3`).
- Parent view (`MyInvoicesView`) owns empty states (`noClient`/`noInvoices`) and `use(invoicesPromise)`; list is pure table.
- `Page` (`components/common/page.tsx`) is `@container flex flex-1 flex-col gap-6 p-6` with `header` outside `Suspense` and `children` inside `Suspense` fallback showing `LoadingDispatcher` (top `LoadingBar`) + optional pulsing rectangle.
- Safe actions for invoices with `z.void()` (no `{}`) and explicit empty `metadata({})` for no-permission actions, without `as any`.

**Non-Goals:**
- No invoice creation/edit/payment mutation on this page (read-only).
- No pagination/filtering beyond simple list.
- No PDF export.

## Decisions

**1. Navigation placement & gating**
- Insert `myInvoices` into `navigationSection()` before `myTasks` in `config/sidebar-menu.ts` with `Receipt`, no `requiredPermission`. Rationale: matches Profile pattern; product wants everyone to see it.

**2. Data access — safe actions**
- `getMyInvoices`/`getMyPayments` as `sessionAction.inputSchema(z.void()).metadata({}).action` (no `as any`) — `z.void()` allows `getMyInvoices()` with no `{}`, empty `metadata({})` explicitly documents no permission and satisfies `SafeActionClient` builder (`this` requires `inputSchema`→`metadata`→`action`, see `tasks.ts:278` `updateTaskStatus`). Alternative `actionClient.use(...).action` without metadata fails type; `as any` hack removed.
- `getMyInvoiceDetails` as `sessionAction.inputSchema(z.object({invoiceId:z.uuid()})).metadata({}).action` without empty object param.
- `getClientInvoices`/`getClientPayments` as `sessionAction.inputSchema(z.object({clientId:z.uuid()})).metadata({permission:{module:"client-activity",action:"view"}}).action` with `ctx.session` ownership check.
- Derive `overdue` like `sales.ts:99`. Return `MyInvoice & {outstandingBalance}` and `{clientId,invoices}` for `getMyInvoices`; callers use `use(promise)` or `result.data`/`unwrapResponse`.
- Email fallback: `or(eq(userId), eq(email))` to cover legacy `clients.email` without `userId`; `inArray(clientId, uniqueIds)` for invoices/payments.

**3. Route & Page**
- `app/dashboard/my-invoices/page.tsx` is async server, `auth()` guard, `getTranslations("myInvoices")`, `const invoicesPromise = getMyInvoices()`, renders `<Page header={<PageHeader .../>} fallback={<div className="h-96 animate-pulse..."/>}><MyInvoicesView invoicesPromise={...}/></Page>`. Header outside `Suspense` shows immediately; `Page`’s `Suspense` shows `LoadingDispatcher` + rectangle while `MyInvoicesView` suspends via `use`. No `loading.tsx` (replaced by `Page`’s `Suspense`).
- `Page` (`components/common/page.tsx`) is `@container` reference for container queries, with `header` prop outside `Suspense`, `children` inside.

**4. UI composition**
- `MyInvoicesView` (`use client`, `use(invoicesPromise)`) handles `hasClient = !!data?.clientId` and empty `data.length===0` with `Card` (`noClient`/`noInvoices`), delegates to `MyInvoicesList`.
- `MyInvoicesList` is pure `Card` + `Table` (5 headers, no `border` on container `overflow-auto` only, `colSpan={5}` for details row).
- `MyInvoicesRow` holds `expanded` (`useState(false)`), `details` (`{items,payments}|null`) and `loading` plus `useLoadingIndicator` (`startLoading`/`stopLoading`). `TableRow` is `cursor-pointer onClick` toggling `expanded`; caret is plain `ChevronUp/Down` icon `inline-flex` with `invoiceNumber` in same `TableCell` (no `Button` cell, no `stopPropagation`). `useEffect` loads `getMyInvoiceDetails({invoiceId})` only when `expanded && details===null`, with `startLoading`/`stopLoading`.
- `InvoiceDetailsRow` is hidden via `Activity mode={expanded?"visible":"hidden"}` keeping mounted, with `MyInvoiceDetails` (6-field grid) on top and `flex flex-col @[900px]:flex-row` for items/payments below. Split into `MyInvoicesItemsTable`/`MyInvoicesPaymentsTable`.
- Formatting via `formatCurrency`/`formatQuantity` (`lib/util/money.ts`) and `formatISODate` (`lib/util/schedule.ts: formatISODate` wrapping `parseISODate` + `Intl.DateTimeFormat`).

**5. i18n & Profile**
- Keys `sidebar.myInvoices`, `breadcrumb.myInvoices`, `myInvoices.*` in EN/ES.
- `app/dashboard/profile/page.tsx` for `user` role bypasses `clients:view`/`client-activity:view` and uses `getMyInvoices()`/`getMyPayments()` plus direct `db` client lookup to show own invoices, with `client && (canView||isUser)` for `ActivityTimeline`.

## Risks / Trade-offs

- **Eager fetch if `Activity` always mounted** → Mitigated by lazy `useEffect` gated on `expanded && details===null`, plus `Activity` hidden keeps mounted without remount reload.
- **Empty `metadata({})` looks redundant** → Required for builder; explicitly documents no permission vs `permission:{...}`.
- **Cross-store legacy email fallback** → Shows invoices from all stores for same email; acceptable for client history, store filter deferred.
- **Container query vs viewport** → `Page` is `@container`, details use `@[900px]:flex-row` and `MyInvoiceDetails` uses `@[600px]:grid-cols-3` relative to page, not viewport (`lg:`).

## Migration Plan

- Additive, no migration; `pnpm build` verifies `SafeActionClient` types, nav, table, Activity, container queries, `Page` fallback.
- Rollback: remove sidebar item and `app/dashboard/my-invoices`, revert `lib/actions/invoices.ts` to non-safe actions.

## Open Questions

- Pagination/filter for my-invoices — deferred.
- Cache `getMyInvoices` with `unstable_cache` — deferred.
