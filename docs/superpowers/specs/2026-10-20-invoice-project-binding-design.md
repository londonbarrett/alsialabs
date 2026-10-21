# Invoice → project binding (my-invoices) — Design

## Why this exists

Users who receive invoices through the my-invoices module (`/app/mis-facturas`) can't relate those invoices to the projects they own. Binding an invoice to a project makes project-level reporting and bookkeeping possible: from the invoice list, a user picks one of their owned projects (or clears the binding) and the row updates instantly.

The binding also feeds the project side: bound invoices appear in the project's expenses section (`/app/proyectos/[id]/gastos`) as rows in the merged spend table, and their **paid amount** counts toward every spend total — the budget bar, the table footer, and the projects-list card aggregates.

Today the data column exists (`invoice.project_id`, nullable FK with `onDelete: set null`) and `getMyInvoices` already selects it, but nothing writes it, nothing renders it, and my-invoices has no optimistic store — the view reads a promise directly. So this capability is: one small server action, one dialog, one new column pair (project + actions), and the my-invoices optimistic store built from scratch following the established pattern.

## Goals

- Row action "Bind to Project" on each row of the my-invoices table, opening a dialog listing the user's **owned** projects.
- One dialog serves bind, rebind, and clear: it preselects the invoice's current project (or the "No project" option) and submitting writes the choice.
- Optimistic update: the dialog closes and the row reflects the new project immediately, committed on success, discarded on failure (toasts via `useSettle`).
- Project visible in **both** the table (new "Project" column) and the row's expanded details.
- Server mutation through next-safe-action with the same ownership mechanism as `getMyInvoices` (invoice must belong to one of the user's clients).
- Project expenses section shows bound invoices as rows in the merged table — description = invoice number, type badge = "Invoice", amount = paid amount, date = issue date — with **no actions** (bind/unbind lives only in my-invoices).
- Bound invoices count as spend: `paidAmount` only, all statuses included (even cancelled — a bound invoice is always a row, `0` paid contributes `0` to totals).

## Non-goals / anti-goals

- No collaborator projects in the picker — `getProjects` already returns owner-only projects for non-super users; reuse it as-is, don't widen it.
- No DB migration — `project_id` already exists; only a Drizzle select/DTO extension (`projectName`) is added.
- No changes to sales (`/app/ventas`): `updateInvoice` stays untouched — it is a full-replace action gated by `sales:edit`, which the `user` role doesn't have, and it rewrites `userId`; it must not be reused for binding.
- No new permission module — my-invoices actions use `.metadata({})` / revalidate-only metadata guarded by ownership checks; the bind action follows suit. The one authorization change in scope is `getProjects` dropping its `projects:view` gate (see Design → Authorization); the broader "ownership as the gate for my-* sections" mechanism refactor is **separate future work** that this change is the first step of.
- No binding from other routes (timeline, sales) and no bulk binding.
- No unbinding, editing, or filtering of invoices from the expenses section — the project side is read-only display.
- No `useReducer`/list `useState` in components, no `reset` action, no module-level singleton store.

## Decisions (as agreed)

| Topic                   | Decision                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server action           | New dedicated `bindInvoiceToProject` (next-safe-action `sessionAction`)                                                                                                      |
| Ownership               | Reuse `getMyInvoices`'s client-ids mechanism (`clientsTable.userId` / email → `inArray(invoicesTable.clientId, …)`) + verify the target project is owned by the session user |
| Picker contents         | Owned projects only (existing `getProjects` behavior)                                                                                                                        |
| Dialog                  | Single dialog for bind, rebind, and clear ("No project" option)                                                                                                              |
| Visibility              | Project shown in a new table column **and** in expanded details                                                                                                              |
| Store                   | New `stores/my-invoices/` package, whole-state list pattern                                                                                                                  |
| Authorization           | Ownership is the gate: `getProjects` drops its `projects:view` permission requirement (decision B — folded into this feature)                                                |
| Streaming               | Page-level Suspense preserved: seed resolved in an async server component child                                                                                              |
| Spend semantics         | Invoices count toward spend by **`paidAmount` only**; **all statuses included** (cancelled rows show and count their paid value)                                             |
| Invoice row amount      | Amount cell shows the paid amount only — matches exactly what totals sum                                                                                                     |
| Type badge              | "Invoice"                                                                                                                                                                    |
| Project-side visibility | Same gate as the expenses section it lives in (`projectScopedAction` + `expenses:view`, mirroring `getExpensesByProjectId`)                                                  |

## Design

### Authorization: ownership as the gate

The premise: for "my-*" sections, ownership is the real authorization — a user may act on invoices they own (via their clients) and projects they own; a blanket `projects:view` permission is a proxy that doesn't fit and would break the picker for e.g. the seeded `retailer` role, which owns projects but lacks the permission.

In scope for this feature:

- `getProjects` (`actions/projects.ts:38`) drops `permission: { module: "projects", action: "view" }` from its metadata (plain `.metadata({})`, like `getMyInvoices`). The body already enforces ownership: super users see all, everyone else only rows matched by the `projectOwnersTable` `exists` filter (`actions/projects.ts:92-94`). **`getProjects` currently has zero callers in app code**, so this change has no regressions — the bind dialog becomes its first consumer.
- `bindInvoiceToProject` guards itself by ownership (invoice → caller's clients; project → `projectOwnersTable`), with no permission metadata.

Consequences, deliberate:

- The Bind button always renders for any authenticated user on the my-invoices page — the dialog works or shows an empty "no owned projects" state; clearing an existing binding always works (invoice ownership is the only gate on the mutation).
- Revoking `projects:view` from a role no longer affects the project _picker_; other project queries (`getProjectsWithDetails`, `getProjectForEdit`, `getProjectContext`) keep their existing permission gates, and `/app/proyectos` keeps its page-level `hasPermission` — widening those is the future refactor, not this feature.

### Server action: `bindInvoiceToProject`

Schema (`actions/schemas/invoice.ts`):

```ts
export const BindInvoiceToProjectSchema = z.object({
  invoiceId: z.uuid(),
  projectId: z.uuid().nullable(), // null = clear binding
})
```

Action (`actions/invoices.ts`), modeled on `getMyInvoiceDetails`'s guard and `cancelInvoice`'s shape:

- `sessionAction.metadata({ revalidate: ["/app/mis-facturas"] })`, no `permission` (same as every other `getMy*` action — ownership is the guard).
- Resolve the caller's client ids exactly as `getMyInvoices` does (`clientsTable.userId = session.user.id` OR `clientsTable.email = session.user.email`). If the invoice's `clientId` is not in that set → `returnActionError("FORBIDDEN")`. If the invoice doesn't exist → `NOT_FOUND`.
- When `projectId !== null`, verify the session user owns that project: look up `projectOwnersTable` for `{ projectId, userId: session.user.id }` (super users bypass, mirroring `getProjects` at `actions/projects.ts:93`). Missing owner → `FORBIDDEN`.
- `db.update(invoicesTable).set({ projectId }).where(eq(invoicesTable.id, invoiceId)).returning()`; return the updated row's `id` + `projectId` (enough to commit).
- Existing error codes reused from `actions/error-codes.ts`; no new codes needed.

### Project expenses surface: bound invoices as spend

**Query** — new `getProjectInvoices` in `actions/invoices.ts`:

- `projectScopedAction` with `permission: { module: "expenses", action: "view" }` — deliberately identical to `getExpensesByProjectId` (`actions/expenses.ts:46`), so invoice rows appear for exactly the people who can already see the section (project access via `projectScopedAction` + the section's permission). My call, mirroring the host section rather than inventing a per-query rule.
- Input `{ projectId: z.uuid() }`; selects from `invoicesTable` where `projectId = <id>`, **no status filter** (cancelled included), ordered by `issueDate`.
- Output: array of `ProjectInvoiceDTO` (`actions/schemas/invoice.ts`): `{ id, invoiceNumber, status, paidAmount, issueDate }`. `grandTotal` is not needed — every displayed/counted figure is `paidAmount`.

**Store** — extend `stores/expenses/` (the section's own store, no sibling-store imports):

- State shape changes from `ExpenseWithCategoryDTO[]` to `{ expenses: ExpenseWithCategoryDTO[]; invoices: ProjectInvoiceDTO[] }`. Both keys are server lists and there are no client-only slices, so `serverSlice` stays omitted — a reseed replaces the whole state, refreshing both lists together.
- `expenseReducer`'s existing `add | update | replaceTemp | delete` cases operate on `state.expenses`; **no invoice actions** (read-only — there is nothing to mutate optimistically from this side).
- `createExpensesStore(seed)` takes `{ expenses, invoices }`; `useExpensesState()` returns both plus `pending`.
- `ExpensesProvider` seed comes from the page: `app/app/proyectos/[id]/gastos/page.tsx` adds `getProjectInvoices({ projectId: id })` to its existing `Promise.all` and passes the pair down.

**View** — `components/projects/expenses/project-expenses.tsx` + `expenses-table.tsx`:

- Merge a third variant into the sorted rows: `{ key: inv.id, type: "invoice", invoice, date: inv.issueDate }`, sorted with the existing task/expense rows by date.
- `CombinedExpenseRow` union gains the invoice variant; `expenses-table.tsx` renders it: description = `invoiceNumber`, type = "Invoice" badge (reuse the existing singular label — check `common.*`, else `invoiceItem.invoice` at `messages/en.json:558` — colored distinctly from the blue Task badge and the gray category badge), amount = `<Money value={invoice.paidAmount}/>`, date = `issueDate`, **no actions cell content** for invoice rows (the column is already conditional on `canEdit || canDelete`).
- **Totals**: `expenseTotal + taskCostTotal + invoicePaidTotal` where `invoicePaidTotal = invoices.reduce(sum of Number(paidAmount))` — drives the budget bar, the "% used"/over-budget flags, and the table footer total in `project-expenses.tsx:155-171, 207-245, 257-261`.

**Server aggregates** — `actions/projects.ts:186-201, 312-313`:

- Add a third grouped sum over `invoicesTable.paidAmount` by `projectId` (all statuses, cast to numeric the same way the existing sums do) and fold it into the `expenses` figure (`actions/schemas/project.ts:105`) that feeds the projects-list cards' budget bars. One code path, same semantics as the client totals: spend = expenses + task costs + invoice paid amounts.

### DTO: project name

The table and details must render a project **name**, but the DTO only carries `projectId`:

- `getMyInvoices` adds `projectName: projectsTable.name` via a `leftJoin` on `projectsTable` (null when unbound).
- `getMyInvoiceDetails` (`actions/invoices.ts:251`) must add the same `leftJoin`/select — its output schema is `MyInvoiceSchema`-based and would fail validation otherwise.
- `MyInvoiceSchema` (`actions/schemas/invoice.ts:96` region) gains `projectName: z.string().nullable()` alongside the existing `projectId`.
- No schema/migration changes — this is a select-only extension.

### Optimistic store: `stores/my-invoices/`

New package following the whole-state-list pattern (`stores/expenses/`, `stores/my-tasks/`):

- `my-invoices-reducer.ts` — state is the seed itself (`MyInvoicesResultDTO`: `{ clientId, invoices }`); one action `{ type: "bindProject"; invoiceId; projectId; projectName }` patching the matching row. Whole state is the server's list → **omit `serverSlice`** (a reseed replaces it wholesale). No `reset`.
- `my-invoices-store.ts` — `createOptimisticStore({ initialState, reducer })`, exports context + `useMyInvoicesStore()` that throws a provider-named error.
- `use-my-invoices-state.ts` — the file's only export; selects `s.optimistic` (callers derive `invoices`/`clientId` from it, same as the current view).
- `use-my-invoices-actions.ts` — `bindToProject(invoiceId, projectId, projectName)` running through `run()` from `useOptimisticAction` with `commitAction` dispatching `bindProject` again using the server-returned `{ id, projectId }` (name comes from the dialog's selected project, which the caller passes in); reported via `useSettle` (success toast + error/`serverError` handling), returns `void`.
- `my-invoices-store.test.ts` — vitest, beside the file: reducer patch, unknown-id no-op, seed test (mirror `stores/expenses/expense-store.test.ts`).

Provider (`components/my-invoices/my-invoices-provider.tsx`): `const [store] = useState(() => createMyInvoicesStore(seed))` + `useServerReseed(store, seed)`, published through the context. No `useRef`, no `eslint-disable`.

Page (`app/app/mis-facturas/page.tsx`): **streaming is preserved.** `Page` keeps its `Suspense` + `fallback`, and the seed is resolved in a small async server component rendered as the page's child — `unwrapResponse(await getMyInvoices())` → `<MyInvoicesProvider seed={…}><MyInvoicesView /></MyInvoicesProvider>` (mis-tareas resolves at page level, but my-invoices deliberately streams; the header must stay instant). `MyInvoicesView` keeps its `noClient` / `noInvoices` empty states but now reads `useMyInvoicesState()` instead of `use(invoicesPromise)`; the `invoicesPromise` prop goes away.

Project name lookup data is passed as an explicit parameter to the action hook — the store folder never imports `stores/projects/`.

### UI

**Row action + column** (`components/my-invoices/my-invoices-list.tsx`, `my-invoices-row.tsx`):

- New header cells: `common.project` and `common.actions` (sales table convention, `components/sales/sales-invoice-table.tsx:68`).
- Row cell renders the invoice's `projectName` (muted placeholder when null) and a trailing action button labeled via `myInvoices.bindToProject` that opens the dialog directly (the user asked for a labeled button, not an icon dropdown).
- The whole row is `cursor-pointer` with an `onClick` that toggles expansion — the action button **must** call `e.stopPropagation()` so clicking it doesn't expand/collapse the row.
- The expanded details row's `colSpan={5}` (`my-invoices-row.tsx:36`) becomes `colSpan={7}` (or the final column count).

**Bind dialog** (`components/my-invoices/bind-project-dialog.tsx`):

- Uses the `components/common/dialog.tsx` wrapper (`title`/`description`/`open`/`onOpenChange`).
- On open, fetches owned projects via the existing `getProjects` safe action (no permission gate after the change above — ownership filter only). Loading and empty-projects states handled.
- Content: a selectable list — radio-style rows of project names plus a "No project" option — preselected from `invoice.projectId`. `FieldGroup`/`Field` conventions if a form label is used; selection can be a simple controlled state (`components/my-tasks/my-tasks-view.tsx` shows the Select-from-data precedent; `components/clients/client-combobox.tsx` the searchable precedent — start with the simple list, add search only if project lists are large).
- Footer: cancel + a confirm button (`myInvoices.bind` / `myInvoices.clear` wording per selection).
- Submit: close the dialog immediately, then call `bindToProject(...)` fire-and-forget (the payment-dialog precedent: close first, settle toasts live in the action hook). No `toast` or `run()` in the component.

**Expanded details** (`components/my-invoices/my-invoice-details.tsx`): add a "Project" entry to the details grid showing `projectName` (or a muted "No project"), reading the same store row so it updates with the optimistic patch.

### Translations

`messages/en.json` + `messages/es.json`, structurally identical, under `myInvoices.*` (namespace exists; check `common.project` and `common.actions` are reused for headers):

- `bindToProject` (row button), `bind` (confirm), `clear` (clear confirm), `bindTitle`/`bindDescription` (dialog), `noProject` ("No project" option), `bindSuccess` (toast), `noOwnedProjects` + reuse `common.loading` for dialog states.

Error messages reuse `errors.forbidden` / existing `errors.*` keys — no new error codes.

### Tests

- `stores/my-invoices/my-invoices-store.test.ts` — reducer `bindProject` (patch, clear, unknown id no-op) + store seed.
- `actions/invoices.test.ts` — `bindInvoiceToProject` cases in the `vitest-drizzle-mock` style already used there: success (owned invoice + owned project), `FORBIDDEN` for a foreign invoice, `FORBIDDEN` for a foreign project, clear (`projectId: null`).
- `actions/projects.test.ts` (or the existing `actions/__tests__/projects.test.ts`) — `getProjects` succeeds without `projects:view` and returns only owner-matched rows for non-super users.
- `stores/expenses/expense-store.test.ts` — reducer cases updated for the `{ expenses, invoices }` state shape; seed test covers both keys.
- `actions/invoices.test.ts` — `getProjectInvoices`: returns bound invoices (incl. cancelled) for an accessible project, `FORBIDDEN` for a project the caller can't access.

## Verification

`pnpm verify` (typecheck + lint + coverage floors). Manual: bind/rebind/clear from `/app/mis-facturas`, row + details reflect the change without reload, expansion still toggles when clicking elsewhere on the row, and the button click doesn't toggle it. On `/app/proyectos/[id]/gastos`: bound invoices appear as "Invoice" rows sorted by issue date (cancelled included), the budget bar/footer/over-budget flag and the projects-list card totals all include `paidAmount`, and clearing the binding removes the row and its contribution.

## Left to the builder

- Exact dialog list styling and whether to add search to the project picker (start simple).
- Toast wording details beyond the keys above.
- Placement of the Project column (proposed: between Status and Outstanding) if it reads better elsewhere.
- Whether the expenses-section invoice row shows a status badge (e.g., muted for cancelled) — the DTO carries `status`, so it's available either way.
