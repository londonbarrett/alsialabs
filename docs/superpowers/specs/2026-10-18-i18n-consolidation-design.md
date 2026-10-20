# i18n message consolidation — Design

## Why

`messages/en.json` and `messages/es.json` carry 807 keys each. A static scan (handling dynamic lookups, template literals, string concatenation, full-path data files, `getActionT`, and array destructuring) found **149 keys never read** and **148 redundant duplicate values** among the live keys. The dead keys are dominated by a legacy `actions.*` error-message system superseded by the live `errors.CODE` map, plus `emails.*` (templates hardcode Spanish), `importCsv.*`, and `ui.*`. The duplicates are mostly generic labels redefined per namespace (`"Actions"` ×9, `"Description"` ×9, `"Name"` ×7, …) and the `sidebar`/`breadcrumb` route labels defined twice.

## Goals

- Delete every unreferenced key from both locales.
- Define each duplicated label **once** in a shared namespace.
- Fix the breadcrumb, which looks up English keys against Spanish URL segments (`t("clientes")` vs key `clients`), so it silently falls back to the raw URL segment.

## Non-goals

- Changing any English user-visible string.
- Restructuring the dynamic key-maps (`errors.*`, `sales.statuses.*`, `projects.status.*`, `projects.tasks.status.*`, `projects.tasks.priority.*`, `projects.colors.*`, `activity.*`, `activities.types.*`, `projects.routines.*`, `categoryNames.*`, `taxonomyNames.*`, `theme.*`).
- Reducing what ships to the client (out of scope for this change).

## Findings

- 807 keys total; **149 dead**; 79 duplicate-value groups / **148 redundant** instances among the 658 live keys.
- `common` already holds canonical keys for most generic labels (`name`, `email`, `phone`, `actions`, `cancel`, `saveChanges`, `description`, `type`, `date`, `role`, `total`, `status`, `details`, `delete`, `edit`, `view`, `create`, `save`, `subject`, …). The "dead" `common.*` keys are dead only because call sites point at domain copies.
- Nearly every duplicate call site uses the full-path form `t("ns.key")` under a root `useTranslations()`, so repointing is a string edit. Three files use namespace-relative keys and are handled individually (`permission-matrix.tsx`, `app/app/perfil/page.tsx`, `components/sales/line-items-table.tsx`).
- 7 duplicate groups share English but differ in Spanish (`Email`, `Due Date`, `Select a category`, `Assignee`, `Done`, `No invoices yet`, `Line Items`). Per decision, these are merged and standardized on one Spanish wording each.

## Target structure

- **`common.*`** — generic UI labels. Reuses existing keys; adds the missing ones (`amount`, `cost`, `location`, `dueDate`, `priority`, `assignee`, `category`, `budget`, `project`, `task`, `product`, `service`, `owner`, `unassigned`, `overdue`, `cancelled`, `done`, `comments`, `invite`, `searching`, `allStatuses`, `selectCategory`, `addReminder`, `logActivity`, `createInvoice`, `addModule`, `paid`, `store`, `descriptionRequired`, `quantityRequired`, `unitPriceRequired`, `issueDateRequired`, `validationFailed`, `dateCannotBeFuture`, `dateMustBeFuture`, `nameRequired`, …).
- **`invoice.*`** — terms shared by `sales` and `myInvoices` (`invoiceNumber`, `qty`, `unitPrice`, `paymentDate`, `reference`, `outstanding`, `paymentHistory`, `lineItems`, `noInvoices`, `issueDate`).
- **`nav.*`** — route labels keyed by **URL segment** (`dashboard`, `clientes`, `productos`, `ventas`, `actividad`, `usuarios`, `permisos`, `categorias`, `proyectos`, `mis-facturas`, `mis-tareas`, `calendario`, `perfil`, `help`, `support`) plus `nav.sections.*` (`navigation`, `auxiliary`, `store`, `admin`). `app-sidebar.tsx` derives the key from `item.url`; `dashboard-breadcrumb.tsx` uses `t(segment)`. `sidebar` and `breadcrumb` namespaces are deleted; page titles (`clients.title`, `projects.title`, …) repoint to `nav.<segment>`.

## Left untouched

Dynamic key-maps listed under Non-goals, and namespaces with no duplicates.

## Decisions (builder calls)

- Generic labels → `common`; invoice-specific shared labels → `invoice`; route labels → `nav` (keyed by URL segment).
- For the 7 Spanish-differing groups, standardize on the wording already used by the majority of contexts (or the `myInvoices`/`sales` side for invoice terms); no English changes.
- `products.store` (table column) → `common.store`; `sidebar.store` → `nav.sections.store` (contexts differ).
- `errors.*` stays a code map; domain mirrors such as `activities.dateCannotBeFuture` collapse into `common.dateCannotBeFuture`.

## Verification

- `pnpm verify` (typecheck + lint + unit coverage).
- `pnpm test:e2e` — asserts English labels (`link "Clients"`, `heading "Permissions"`, …). Values are preserved, so these must keep passing.
- No unit test covers i18n key presence; the dead-key scan and the e2e label assertions are the guards.
