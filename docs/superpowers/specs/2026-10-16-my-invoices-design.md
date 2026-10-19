# My invoices — Design

## Why this exists

People who buy from this app's stores need to see their own invoices: what they owe, what they've paid, and the line items behind each total. Until now that information lived only on the profile page's timeline, or behind admin-facing client-activity permissions. My Invoices gives every authenticated user a first-class billing page without asking them to hold any special permission — the data is theirs by identity, not by grant.

Resolving "whose invoices?" from the session rather than from a picked client is what makes the page safe to expose broadly. The user's client record is found by `clients.userId = session.user.id`, with a fallback to `clients.email = session.user.email` for legacy accounts that predate the link. A user with no linked client is a legitimate case, not an error, so the page shows an empty state instead of a forbidden response.

The page is also shaped by loading behavior. The header must paint immediately while the invoice list suspends, and expanding a row must not fan out into a request per row — details are fetched once, lazily, on first expand. Meanwhile the profile timeline keeps working exactly as before; this is an addition, not a move.

## Goals

- Offer `/app/mis-facturas` to any authenticated user with no permission requirement, redirecting unauthenticated visitors to `/login`.
- Resolve the user's client(s) by userId with an email fallback, and show an empty state when none is linked.
- List only the user's own invoices, newest first, with derived overdue status.
- Let each row expand into details, line items, and payment history fetched once on first expand.
- Keep the profile timeline's invoices working independently of this page.
- Expose the data through properly typed safe actions with ownership checks.

## Design

### Access and client resolution

Any authenticated user can open `/app/mis-facturas`; no permission is required. The page resolves the client(s) linked to the current user via `clients.userId = session.user.id OR clients.email = session.user.email`, the email match covering legacy users. When neither matches, the page still renders — header, empty state, no forbidden error. An unauthenticated visitor is redirected to `/login`.

### Page composition and loading

The page uses `Page` (`components/common/page.tsx`) as its `@container flex flex-1 flex-col gap-6 p-6` shell, with the `header` (`PageHeader` title/subtitle/`Receipt`) rendered outside `Suspense` and the content inside it. The `Suspense` fallback shows the app `LoadingBar` via `LoadingDispatcher` plus a pulsing rectangle — `h-96 animate-pulse rounded-xl border bg-muted/30` — so the title and icon are visible immediately while the list suspends on `getMyInvoices`. `MyInvoicesView` is a client component that unwraps the list with `use(invoicesPromise)` and performs the empty check; `MyInvoicesList` stays a pure table, and `MyInvoicesRow` owns the `expanded` state, the `Activity` wrapper, `useLoadingIndicator`, and the row `onClick`.

### The invoice table

`MyInvoicesList` shows only invoices whose `invoice.clientId` is in the set of client ids linked to the user (by userId or email), ordered by `issueDate` descending — a client with invoices in a shared store sees only their own. The table has five columns: `invoiceHash` (the invoice number with a caret icon), `date` (`issueDate`), `status`, `outstanding` (`grandTotal - paidAmount`), and `total` (`grandTotal`).

Status derives `overdue` when `dueDate < today`, the status is not in (`paid`, `cancelled`, `draft`), and `paidAmount < grandTotal` — a past-due invoice with a balance outstanding reads as overdue regardless of its stored status. The table container carries no `border`, only `overflow-auto`, and the caret is a plain `ChevronUp`/`ChevronDown` icon in `text-muted-foreground` inline with the invoice number — no `Button` cell and no dedicated caret `TableHead`. Clicking anywhere on a row (the `cursor-pointer` target) expands or collapses its details. Empty-list handling lives in `MyInvoicesView`, not in `MyInvoicesList`.

### Expanding a row: details, items, payments

Expanding a row reveals `MyInvoiceDetails`, a card of six fields — `type`, `date` (`issueDate`), `dueDate`, `total`, `paidAmount`, `outstanding` — laid out as `grid grid-cols-2 @[600px]:grid-cols-3`, sitting above two tables: `MyInvoicesItemsTable` showing description, quantity (`formatQuantity` from `lib/util/money`), unit price, discount/tax percents, and total (`formatCurrency`); and `MyInvoicesPaymentsTable` showing payment date (`formatISODate` via `parseISODate` + `Intl.DateTimeFormat`), amount, method, and reference, ordered by payment date descending. The two tables are composed inside `MyInvoicesRow`/`InvoiceDetailsRow`.

Details load lazily: `getMyInvoiceDetails({ invoiceId })` fires only on the first expand, when `details === null`, driving the app `useLoadingIndicator` (`startLoading`/`stopLoading`) alongside an inline `common.loading` indicator. Once fetched, `details` is cached, so collapsing and re-expanding makes no further requests. The row stays mounted between states — `Activity` renders with `mode={expanded ? "visible" : "hidden"}` — so toggling never remounts and reloads the content. Responsiveness is measured against the `Page` `@container`, not the viewport: the items/payments section uses `flex flex-col @[900px]:flex-row`, and the details card switches to three columns at `@[600px]` rather than a viewport `lg:` breakpoint.

### Profile timeline stays

The profile page (`/app/perfil`) continues to show invoices through its existing timeline, independent of My Invoices. For the `user` role, the profile renders own invoices and payments via `getMyInvoices`/`getMyPayments` without requiring `client-activity:view`, even when no client is linked through `clients:view`. A user with a linked client sees their invoices and payments on the profile; a user with no linked client sees nothing and no error is thrown.

### Server actions

`getMyInvoices`, `getMyPayments`, and `getMyInvoiceDetails` are safe actions built with `sessionAction` (or `actionClient` with an `auth` check) and zod schemas. `getMyInvoices` and `getMyPayments` take `z.void()` — callable as `getMyInvoices()` with no `{}` — and carry no permission `metadata`, because the data is scoped to the session's own client set; `getMyInvoices` returns `{ clientId, invoices }` ordered by `issueDate` descending. `getMyInvoiceDetails` takes `z.object({ invoiceId: z.uuid() })` and returns `{ invoice, items, payments }` only after an ownership check that `invoice.clientId` is in the user's client set. The builder is written as `sessionAction.inputSchema(z.void()).metadata({}).action` (or `actionClient.use(...).inputSchema(z.void()).action`) — no `as any`, no empty `{}` parameter.

The admin-facing counterparts `getClientInvoices` and `getClientPayments` stay on `sessionAction` with `metadata({ permission: { module: "client-activity", action: "view" } })` and `z.object({ clientId: z.uuid() })` — that permission gate is theirs, not My Invoices'. All actions report failures with `returnActionError` codes and are consumed via `use(invoicesPromise)` in `MyInvoicesView` and `result.data`/`unwrapResponse` in other callers, with `formatCurrency`, `formatQuantity`, and `formatISODate` handling display formatting.

## Non-goals

- Requiring a permission to view your own invoices. `client-activity:view` gates the admin client-activity actions (`getClientInvoices`/`getClientPayments`), never `getMyInvoices`/`getMyPayments`/`getMyInvoiceDetails`.
- Moving the profile timeline here. `/app/perfil` keeps its own invoice and payment rendering.
- Empty-state logic inside `MyInvoicesList`. The list is a pure table; `MyInvoicesView` decides what "no invoices" renders as.
- Fetching details eagerly for every row. Details arrive once, on first expand, and are cached thereafter.
