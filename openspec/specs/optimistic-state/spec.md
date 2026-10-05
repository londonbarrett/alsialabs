# optimistic-state Specification

## Purpose

Page-scoped optimistic stores, the provider/read-method pattern, and the shared mutation and action-hook contract.

## Requirements

### Requirement: Optimistic client state is a page-scoped store

Client-side optimistic state SHALL be held in a Zustand store created per route visit, never in a module-level singleton and never threaded through props. Every optimistic store SHALL be built by a factory `createXStore(seed)` and published through a `XStoreContext` with a `useXStore()` hook that SHALL throw a provider-named error when no provider is mounted, so a missing provider fails loudly at the boundary instead of silently degrading.

The store SHALL expose exactly `committed`, `pending`, `optimistic`, `pend`, `commit`, and `discard`. It SHALL NOT expose a `hydrate` method, a `reset` action, or a client-keyed scope: the store is seeded once per mount, and fresh server data reaches the client through optimistic actions rather than by re-syncing a mounted store. `createOptimisticStore(initialState, applyAction)` SHALL take exactly two arguments.

The generic store SHALL NOT provide an `isSuccess`, `onSuccess`, or `onFailure` option; `useOptimisticAction` SHALL decide success with a single shared heuristic and SHALL expose only `commitAction`.

#### Scenario: Store hook outside a provider fails loudly

- **WHEN** `useXStore()` is called with no matching provider mounted
- **THEN** it SHALL throw an error naming the provider

#### Scenario: A mutation outside the owning route is impossible

- **WHEN** a component is rendered on a route that does not mount the provider for a store it wants
- **THEN** the render SHALL fail immediately, naming the missing provider

#### Scenario: Navigating to another route yields a fresh store

- **WHEN** the user leaves a route and returns
- **THEN** the provider SHALL remount and build a store seeded with the newly fetched data

#### Scenario: Optimistic state cannot drift from committed state

- **WHEN** any action is pended, committed, or discarded
- **THEN** `optimistic` SHALL be recomputed as `committed` with every pending action applied in order

#### Scenario: A failed mutation reverts automatically

- **WHEN** the server action rejects
- **THEN** the pending action SHALL be discarded and the committed state SHALL be shown again

### Requirement: Store providers follow one construction pattern

Every store provider SHALL build its store with a lazy `useState` initializer — `const [store] = useState(() => createXStore(seed))` — and SHALL publish it through the store's context. Providers SHALL NOT read `ref.current` during render: `react-hooks/refs` forbids it, so `useRef` + `if (storeRef.current == null)` SHALL NOT be used and no `eslint-disable` comment SHALL suppress that rule. No provider SHALL synchronize state from props in an effect, because the store is seeded once per mount.

The provider SHALL be mounted by the route's page, not by the component that consumes the store. Consequently a consuming component SHALL be a single component that calls `useXStore()` directly, rather than a wrapper that renders a provider around an inner content component. `TimelineProvider`, `ActivityProvider`, `InvoiceProvider`, and `ProjectsProvider` are each mounted by their page (`app/app/clientes/[clientId]/page.tsx`, `app/app/actividad/page.tsx`, `app/app/ventas/page.tsx`, and `app/app/proyectos/page.tsx` respectively).

#### Scenario: Provider is built once per mount

- **WHEN** a page re-renders with the same data
- **THEN** the store SHALL NOT be rebuilt or re-seeded

#### Scenario: No lint suppression in providers

- **WHEN** the provider files are linted
- **THEN** they SHALL contain no `eslint-disable` comment

### Requirement: Every store is read through one state hook

Each optimistic store SHALL be read by components through exactly one state hook, `use[Store]State`, living in `stores/use-[store]-state.ts` beside the store it wraps: `useActivityState`, `useInvoiceState`, `useProjectsState`, `useTimelineState`, `useProjectContextState`. A state hook SHALL take no arguments, SHALL be the only export of its file, and SHALL return a single object of named values, so a consumer destructures what it needs in one call. Components SHALL NOT import a store directly and SHALL NOT select `s.optimistic` or `s.pending` themselves. The store's own read methods (`getEntries` `stores/timeline-store.ts`, `getInvoices`/`getPayments` `stores/invoice-store.ts`, `getReminders`/`getClientActivities` `stores/activity-store.ts`, `getProjects`/`getPending` `stores/projects-store.ts`) SHALL stay attached to the store for action hooks to call; they are not the component-facing surface.

A state hook SHALL name each value for what it holds, not for where it sits in the store, and SHALL NOT alias one value under two names: a store whose state already IS the list SHALL return it as `projects` or `entries`, never again as `optimistic`. The hook SHALL NOT expose `committed`, which no consumer reads. Where a value needs a default or a derivation, the hook owns it — `useActivityState` supplies `EMPTY_ACTIVITIES` for a client with no activities yet, `useProjectsState` derives `pendingIds` from the pending queue, and `useProjectContextState` derives `primaryOwner` and `additionalOwners` from the owner list, so components never re-derive them.

A state hook SHALL NOT hold permissions. `useProjectContextState` SHALL return role facts only — `project`, `projectId`, `owners`, `primaryOwner`, `additionalOwners`, `collaborators`, `members`, `categories`, `currentUserId`, `isCurrentUserAdmin`, `isOwner`, `isPrimaryOwner`, `isCollaborator` — and SHALL NOT return `permissions`, `canEdit`, `canDelete`, or `canManageUsers`. A component composes its own capability from those facts plus `useHasPermission`, and every `useHasPermission` call SHALL be invoked unconditionally at the top level of render, never inside a boolean expression such as `isOwner && useHasPermission("projects:edit")`, because that calls a hook conditionally and breaks render order.

#### Scenario: A component reads a store without knowing its layout

- **WHEN** a component needs the current list
- **THEN** it SHALL call the store's `use[Store]State()` hook and SHALL NOT destructure store internals or import the store

#### Scenario: One value is never exposed under two names

- **WHEN** a store's optimistic state is itself the domain value
- **THEN** the hook SHALL return it once under its domain name and SHALL NOT also return it as `optimistic`

#### Scenario: A state hook does not answer permission questions

- **WHEN** a component needs to know whether the user may edit
- **THEN** it SHALL combine a role flag from `useProjectContextState()` with a `useHasPermission()` call, and the state hook SHALL NOT expose a permission-derived flag

### Requirement: Mutations run through one action hook

All optimistic mutations SHALL run through `useOptimisticAction` `stores/use-optimistic-action.ts`, which pends an action, runs the server mutation, then commits on success or discards on failure, and which drives the global loading bar. A caller MAY pass a `commitAction` to apply a second action after the original one commits — used to swap a temporary row for the authoritative server row, or to `replaceTemp` a row the server has just saved.

`RunOptions` SHALL expose `commitAction` only. `isSuccess`, `onSuccess`, and `onFailure` SHALL NOT exist, because no caller passed them; the hook SHALL determine success with a single shared heuristic and SHALL leave toasts to the caller.

#### Scenario: Temporary row is swapped for the saved row

- **WHEN** a create mutation succeeds and the caller passes a `commitAction` issuing `replaceTemp`
- **THEN** the temporary row SHALL be replaced by the row the server saved, so later mutations target the real id

#### Scenario: Loading bar is driven by the mutation

- **WHEN** an optimistic mutation is in flight
- **THEN** the global loading bar SHALL be visible and SHALL hide once it settles

### Requirement: Mutation hooks settle their outcome the same way

Every action hook (`useInvoiceActions`, `useTimelineActions`, `useActivityActions`, `usePaymentActions`, `useProjectActions`, `useProjectsActions`, `useProjectPeopleActions`) SHALL report each mutation through the shared `useSettle` hook `hooks/use-settle.ts`, which toasts the translated `serverError`, returns `validationErrors` for the form to render without toasting, toasts a success message otherwise, and returns `SettleResult` `lib/types.ts`. A handler SHALL return `SettleResult` only when its caller consumes the outcome — the invoice `createInvoice`/`updateInvoice` handlers, whose `InvoiceForm` caller renders the returned `fieldErrors`; every other handler SHALL return `void`, because no caller reads the outcome. Fetch helpers (`loadPayments` `stores/use-payment-actions.ts`, `loadActivities` `stores/use-activity-actions.ts`) SHALL return `void`, SHALL pend and commit the store directly, and SHALL NOT drive the loading bar or toast a success, because reading a list is not a mutation.

#### Scenario: Fire-and-forget handler returns nothing

- **WHEN** a payment, activity, reminder, project, or project-people mutation runs
- **THEN** its handler SHALL return `void` and SHALL still own its success or error toast via `useSettle`

#### Scenario: Invoice form consumes the settled field errors

- **WHEN** `createInvoice`/`updateInvoice` returns validation errors
- **THEN** the handler SHALL return `SettleResult` carrying `fieldErrors` and SHALL NOT toast, so `InvoiceForm` can render them
