# optimistic-state Specification

## Purpose

Page-scoped optimistic stores, the provider/read-method pattern, and the shared mutation and action-hook contract.

## Requirements

### Requirement: Optimistic client state is a page-scoped store

Client-side optimistic state SHALL be held in a Zustand store created per route visit, never in a module-level singleton and never threaded through props. Every optimistic store SHALL be built by a factory `createXStore(seed)` and published through a `XStoreContext` with a `useXStore()` hook that SHALL throw a provider-named error when no provider is mounted, so a missing provider fails loudly at the boundary instead of silently degrading.

The store SHALL expose exactly `committed`, `pending`, `optimistic`, `pend`, `commit`, `discard`, `reseed`, and `reseedFromServer`. It SHALL NOT expose a `hydrate` method, a `reset` action, or a client-keyed scope, which would discard committed state wholesale rather than adopting server data on top of it. `createOptimisticStore` SHALL take a single config object — `{ initialState, reducer, serverSlice? }` — rather than positional arguments, so each factory names its inputs and the key naming the server's slice cannot be confused with a merge callback.

Mutations are the ordinary route for fresh server data. `reseed` exists for the one case a mutation cannot cover: a `router.refresh()` triggered by something outside this store, such as the window regaining focus.

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

Every store provider SHALL build its store with a lazy `useState` initializer — `const [store] = useState(() => createXStore(seed))` — and SHALL publish it through the store's context. Providers SHALL NOT read `ref.current` during render: `react-hooks/refs` forbids it, so `useRef` + `if (storeRef.current == null)` SHALL NOT be used and no `eslint-disable` comment SHALL suppress that rule.

Every provider SHALL re-apply server data through `useServerReseed(store, serverData)`, because a lazy initializer runs once and client state survives `router.refresh()`, so a refresh would otherwise re-render the page with new props that nothing reads. The hook SHALL be typed against `ServerSeededStore<S, A, Seed>`, so it accepts only stores carrying `reseedFromServer` — it SHALL NOT accept a bare apply callback, which would let `useState`'s setter and other non-store state satisfy it. Identity is the correct signal because these props are built by the server component, so a new reference means the server re-ran, whereas client-only re-renders pass the same reference; no deep comparison is required. The store SHALL come from a `useState` initializer and the data from props, so both are stable and no ref is needed to keep a callback fresh. A provider SHALL NOT re-derive its reseed token during render — a token built inline changes identity every render and would reseed constantly — so it SHALL be memoised or the prop used directly. Reseeding SHALL happen in an effect, never during render, preserving the invariant that no render-phase write reaches the store its subscribers are reading.

The provider SHALL be mounted by the route's page, not by the component that consumes the store. Consequently a consuming component SHALL be a single component that calls `useXStore()` directly, rather than a wrapper that renders a provider around an inner content component. `TimelineProvider`, `ActivityProvider`, `InvoiceProvider`, `ProjectsProvider`, `ProjectTasksProvider`, `MyTasksProvider`, and `ExpensesProvider` are each mounted by their page (`app/app/clientes/[clientId]/page.tsx`, `app/app/actividad/page.tsx`, `app/app/ventas/page.tsx`, `app/app/proyectos/page.tsx`, `app/app/proyectos/[id]/page.tsx`, `app/app/mis-tareas/page.tsx`, and `app/app/proyectos/[id]/gastos/page.tsx` respectively). The expenses page nests `ProjectTasksProvider` inside `ExpensesProvider`, because the expenses table lists and edits task cost rows through the project tasks store, and a page SHALL mount every provider its content reads.

#### Scenario: Provider is built once per mount

- **WHEN** a page re-renders with the same data
- **THEN** the store SHALL NOT be rebuilt or re-seeded

#### Scenario: A refreshed server prop reaches a mounted store

- **WHEN** a `router.refresh()` causes the server component to send a provider new seed props
- **THEN** the provider SHALL call `store.reseedFromServer` and the store SHALL adopt the new data

#### Scenario: The reseed hook is not satisfiable by non-store state

- **WHEN** a caller attempts to satisfy `useServerReseed` with a value lacking `reseedFromServer`, such as a `useState` setter
- **THEN** TypeScript SHALL reject the call, because the hook is typed against `ServerSeededStore<S, A, Seed>`

#### Scenario: My tasks reseeds on focus

- **GIVEN** `MyTasksView` has been mounted by `app/app/mis-tareas/page.tsx`
- **WHEN** the window regains focus
- **THEN** `useRefreshOnFocus` SHALL trigger `router.refresh()` and `MyTasksProvider` SHALL reseed the store from the fresh `getMyTasks({})` result

#### Scenario: An active filter survives a focus refresh

- **GIVEN** a status or project filter is applied to the my-tasks list
- **WHEN** a focus refresh reseeds the store with the full task set
- **THEN** the visible list SHALL remain narrowed by the same filter, because the projection is derived from the store rather than fetched per filter

### Requirement: A reseed adopts server data without discarding pending work

`reseed(update)` SHALL set committed state to `update(committed)` and SHALL recompute `optimistic` as that result with every pending action applied in order, so an in-flight optimistic write survives the refresh and its server response still lands on top. `update` SHALL receive the current committed state rather than a replacement value, because the server owns only part of the state: each store's reseed method SHALL replace the slice the server sent and preserve client-only slices — loaded task comments, expanded activity rows, fetched invoice payments — which a wholesale replacement would discard.

Each store factory SHALL expose one method named `reseedFromServer(next)` that takes the new server data, typed as `ServerSeededStore<S, A, Seed>`, so the merge sits beside the state shape, the method is referentially stable for effect dependencies, and one uniform name serves every store. `createOptimisticStore` SHALL build that method in the state creator, from the `serverSlice` its config declares: a reseed replaces that top-level key and leaves every other field untouched, which is all the partial stores need, since their merge is always `{ ...committed, [slice]: seed }`. A store whose state IS the server's slice SHALL omit `serverSlice`, and a reseed then replaces committed state wholesale. No factory SHALL pass a merge callback, and the seed type SHALL be inferred from the declaration — `S[K]` for a slice key, `S` for a whole-state store — so a factory cannot name a slice of the wrong shape and a partial store that forgets its `serverSlice` fails at compile time, because `Seed` infers as the whole state while its provider passes a slice. The method SHALL NOT be attached after construction with `Object.assign` or any other assignment, because a method bolted onto the API object is reachable through neither `getState()` nor a selector, making it a second, undocumented surface. A card SHALL NOT need to pass a callback to `useRefreshOnFocus`, which SHALL continue to drive `router.refresh()` alone.

#### Scenario: An in-flight edit survives a focus refresh

- **WHEN** an action is pending and a refresh reseeds the store with server data that predates it
- **THEN** the pending action SHALL still be applied over the new data and SHALL remain pending until it is committed or discarded

#### Scenario: A pending deletion is not undone by the server

- **WHEN** a deletion is pending and the refresh returns the row because the server has not processed it yet
- **THEN** the row SHALL stay hidden and discarding the pending action SHALL fall back to the refreshed server data

#### Scenario: Client-only state survives a refresh

- **WHEN** a refresh reseeds a store whose client-only slice holds loaded data
- **THEN** that slice SHALL be preserved rather than emptied

#### Scenario: A rejected mutation after a refresh reverts to fresh data

- **WHEN** a pending action is discarded after a reseed
- **THEN** the store SHALL show the newly refreshed server data, not the data as it was before the refresh

#### Scenario: A whole-state store reseeds by replacement

- **GIVEN** a factory whose state IS the server's slice, such as `createProjectsStore` or `createExpensesStore`
- **WHEN** the provider reseeds it
- **THEN** the seed SHALL replace the committed state, because the factory omitted `serverSlice`

#### Scenario: A partial store reseeds only its declared slice

- **GIVEN** a factory whose state also carries client-only fields, such as `createActivityStore` with `activities`
- **WHEN** the provider reseeds it
- **THEN** the seed SHALL replace only the declared `serverSlice` and the client-only fields SHALL survive

#### Scenario: The seed type is inferred from the declaration

- **WHEN** a factory declares `serverSlice: "tasks"`
- **THEN** `Seed` SHALL be `S["tasks"]`, so the provider's seed is checked against the list the server actually sends, not against the whole state

#### Scenario: A missing slice declaration is caught at the provider

- **WHEN** a partial store omits `serverSlice`, leaving `Seed` as the whole state `S`
- **THEN** its `useServerReseed(store, someList)` SHALL fail to typecheck, because the seed is a slice and not `S`

#### Scenario: No lint suppression in providers

- **WHEN** the provider files are linted
- **THEN** they SHALL contain no `eslint-disable` comment

### Requirement: Stores are vanilla stores, never bound hooks

Every optimistic store SHALL be built by `createOptimisticStore` from `createStore` in `zustand/vanilla` and SHALL expose the vanilla `StoreApi` surface: `getState`, `setState`, `getInitialState`, and `subscribe`. A store SHALL NOT be built with `create` from `zustand`, because `create` returns a React hook bound to the store. These stores are shared through context and read imperatively from async handlers, so a callable store invites calling a hook off the render path, which throws `Invalid hook call` at runtime instead of failing at build time.

Reading SHALL follow one split. Reactive reads — the values a component renders — SHALL be selected with `useStore(store, selector)` during render, and only from a state hook. Imperative reads — inside async handlers, action hooks, and tests — SHALL use `store.getState()`. No code SHALL call a store as a function, because a vanilla store is not a function. `createOptimisticStore` SHALL return `StoreApi<OptimisticStore<S, A, Seed>>`, and `useOptimisticAction` SHALL accept that `StoreApi` rather than a `UseBoundStore`.

#### Scenario: An async handler reads the store

- **WHEN** a fetch helper such as `loadActivities` needs the entries already loaded for a client before appending the next page
- **THEN** it SHALL read through a store read method or `store.getState()`, never a hook

#### Scenario: A component reads the store

- **WHEN** a state hook selects `optimistic` or `pending`
- **THEN** it SHALL select with `useStore(store, selector)` during render

#### Scenario: The store is not callable

- **WHEN** a store factory's result is inspected
- **THEN** it SHALL be an object exposing `getState`, `setState`, `getInitialState`, and `subscribe`, and SHALL NOT be a function

### Requirement: Every store is read through one state hook

Each optimistic store SHALL be read by components through exactly one state hook, `use[Store]State`, living beside the store it wraps: `useActivityState`, `useInvoiceState`, `useProjectsState`, `useTimelineState`, `useProjectContextState`, `useProjectTasksState`, `useExpensesState`. A state hook SHALL take no arguments, SHALL be the only export of its file, and SHALL return a single object of named values, so a consumer destructures what it needs in one call. Components SHALL NOT import a store directly and SHALL NOT select `s.optimistic` or `s.pending` themselves.

A store SHALL expose nothing beyond the `StoreApi` surface and its own state. No store SHALL attach methods with `Object.assign` or any other post-construction assignment: the Zustand v5 `createStore` contract puts actions in the state returned by the state creator, using its `get` argument, and a method bolted onto the API object is reachable neither through `getState()` nor through a selector, which makes it a second, undocumented surface. `createActivityStore`, `createInvoiceStore`, `createProjectsStore`, `createTimelineStore`, `createProjectTasksStore`, and `createExpensesStore` SHALL therefore each return `createOptimisticStore(...)` directly and uniformly. A read off the render path SHALL be written inline at its call site against `store.getState()` — as `loadActivities` `stores/activity/use-activity-actions.ts` does to read a client's already-loaded entries — and SHALL NOT be wrapped in a store method for a single caller.

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

### Requirement: Store internals are grouped one folder per domain

Everything belonging to one store SHALL live in a single folder under `stores/`, named for the domain: `stores/activity/`, `stores/invoice/`, `stores/projects/`, `stores/project-context/`, `stores/project-tasks/`, `stores/expenses/`, `stores/timeline/`. A folder SHALL hold that domain's reducer, store factory, store test, action hooks, and state hook together — e.g. `stores/invoice/` holds `invoice-reducer.ts`, `invoice-store.ts`, `sales-reducer.ts`, `payment-reducer.ts`, `use-invoice-actions.ts`, `use-invoice-state.ts`, and `use-payment-actions.ts`. A test SHALL sit beside the file it covers.

The shared `useOptimisticAction` SHALL stay at `stores/use-optimistic-action.ts` rather than in a domain folder or a shared subfolder, because it is infrastructure every domain uses rather than one domain's state. Payment state SHALL live in `stores/invoice/` rather than a folder of its own, because payments have no store of their own — `salesReducer` composes `paymentReducer` into the invoice store's `SalesState`, and `usePaymentActions` writes to that store.

Modules inside one folder SHALL import each other relatively (`./invoice-reducer`); code outside `stores/` SHALL import across folders absolutely (`@/stores/invoice/invoice-store`). No store folder SHALL import another store folder, so each domain is self-contained.

#### Scenario: A store's parts are found in one place

- **WHEN** a change is needed to how invoices are stored and mutated
- **THEN** every relevant file is inside `stores/invoice/`

#### Scenario: Domain folders do not depend on each other

- **WHEN** the files under `stores/` are inspected
- **THEN** no folder imports from a sibling domain folder

### Requirement: Mutations run through one action hook

All optimistic mutations SHALL run through `useOptimisticAction` `stores/use-optimistic-action.ts`, which pends an action, runs the server mutation, then commits on success or discards on failure, and which drives the global loading bar. A caller MAY pass a `commitAction` to apply a second action after the original one commits — used to swap a temporary row for the authoritative server row, or to `replaceTemp` a row the server has just saved.

`RunOptions` SHALL expose `commitAction` only. `isSuccess`, `onSuccess`, and `onFailure` SHALL NOT exist, because no caller passed them; the hook SHALL determine success with a single shared heuristic — `defaultIsSuccess` `lib/util/action-result.ts` — and SHALL leave toasts to the caller. A `commitAction` callback MAY return `undefined` to skip the follow-up action, for a mutation whose server result only sometimes produces one — completing a recurring task spawns its next occurrence, most completions do not.

#### Scenario: Temporary row is swapped for the saved row

- **WHEN** a create mutation succeeds and the caller passes a `commitAction` issuing `replaceTemp`
- **THEN** the temporary row SHALL be replaced by the row the server saved, so later mutations target the real id

#### Scenario: Loading bar is driven by the mutation

- **WHEN** an optimistic mutation is in flight
- **THEN** the global loading bar SHALL be visible and SHALL hide once it settles

### Requirement: Mutation success is decided by one shared heuristic

`useOptimisticAction` SHALL decide whether a mutation succeeded with `defaultIsSuccess` `lib/util/action-result.ts`, and `useSettle` SHALL agree with it, so a result that commits is the same result that toasts success. The heuristic SHALL treat a result as failure only when it carries evidence of failure — a next-safe-action `serverError` or `validationErrors`, or a store action's `success: false` — and SHALL treat every other result as success, including a missing result.

A next-safe-action mutation that returns no value resolves to an empty object, so a delete or a plain update the server completes successfully SHALL be recognised as success and SHALL commit. A heuristic that required `data !== undefined` SHALL NOT be used, because it misreads a void success as a failure, discards the applied action, and shows an error — the mutation has already landed on the server, so the row reappears on the next fetch.

#### Scenario: A void mutation commits and toasts success

- **WHEN** a delete action that returns nothing completes successfully
- **THEN** `defaultIsSuccess` SHALL return true, the pending action SHALL commit, and `useSettle` SHALL toast the success message

#### Scenario: A server error still reverts

- **WHEN** a mutation resolves to `{ serverError }` or `{ validationErrors }`
- **THEN** `defaultIsSuccess` SHALL return false and the pending action SHALL be discarded

#### Scenario: A store action reports failure explicitly

- **WHEN** a store action resolves to `{ success: false, error }`
- **THEN** `defaultIsSuccess` SHALL return false and `useSettle` SHALL toast the error

### Requirement: Mutation hooks settle their outcome the same way

Every action hook (`useInvoiceActions`, `useTimelineActions`, `useActivityActions`, `usePaymentActions`, `useProjectActions`, `useProjectsActions`, `useProjectPeopleActions`, `useProjectTasksActions`, `useExpensesActions`) SHALL report each mutation through the shared `useSettle` hook `hooks/use-settle.ts`, which toasts the translated `serverError`, returns `validationErrors` for the form to render without toasting, toasts a success message otherwise, and returns `SettleResult` `lib/types.ts`. A handler SHALL return `SettleResult` only when its caller consumes the outcome — the invoice `createInvoice`/`updateInvoice` handlers, whose `InvoiceForm` caller renders the returned `fieldErrors`; every other handler SHALL return `void`, because no caller reads the outcome. Fetch helpers (`loadPayments` `stores/invoice/use-payment-actions.ts`, `loadActivities` `stores/activity/use-activity-actions.ts`) SHALL return `void`, SHALL pend and commit the store directly, and SHALL NOT drive the loading bar or toast a success, because reading a list is not a mutation.

#### Scenario: Fire-and-forget handler returns nothing

- **WHEN** a payment, activity, reminder, project, or project-people mutation runs
- **THEN** its handler SHALL return `void` and SHALL still own its success or error toast via `useSettle`

#### Scenario: Invoice form consumes the settled field errors

- **WHEN** `createInvoice`/`updateInvoice` returns validation errors
- **THEN** the handler SHALL return `SettleResult` carrying `fieldErrors` and SHALL NOT toast, so `InvoiceForm` can render them

### Requirement: Focus refresh is registered once by the route tree's root

The application SHALL register focus-driven refresh in exactly one place: the `FocusRefresh` client component, which calls `useRefreshOnFocus()` and renders nothing, mounted once by `app/app/layout.tsx`. `router.refresh()` re-runs the whole route tree, so a single listener at the root supplies fresh seed props to every provider mounted beneath it — one listener is both necessary and sufficient.

Store providers SHALL NOT call `useRefreshOnFocus`, nor SHALL components that render store content. A per-provider owner would force a decision on any route that mounts more than one provider — on `app/app/proyectos/[id]`, `ProjectContextProvider` nests `ProjectTasksProvider` — and the loser of that decision needs a comment recording its silence, which is a rule the code only keeps because a comment says so. With no owner inside the tree, no second listener can be added by accident and the request count does not depend on which cards a page happens to render.

A route SHALL refresh on focus whether or not it mounts a store provider, because the layout wraps every authenticated route: server-rendered data on a page with no store goes stale for the same reason and is recovered the same way.

#### Scenario: A focus event issues exactly one refresh

- **GIVEN** `app/app/layout.tsx` has mounted `FocusRefresh`
- **WHEN** the window regains focus
- **THEN** exactly one `router.refresh()` SHALL be issued, and every mounted store provider SHALL reseed from its result

#### Scenario: A nested provider registers no listener

- **GIVEN** `app/app/proyectos/[id]` mounting `ProjectContextProvider` around `ProjectTasksProvider`
- **WHEN** the window regains focus
- **THEN** neither provider SHALL have registered a `visibilitychange` listener, and the route SHALL still refresh exactly once through `FocusRefresh`

#### Scenario: A consumer renders without requesting a refresh

- **WHEN** `MyTasksView`, `ActivityTimeline`, `RemindersCard`, `InactiveClientsCard`, or `TasksCard` renders
- **THEN** it SHALL NOT call `useRefreshOnFocus`, and its page SHALL still refresh on focus through the root layout

#### Scenario: A route with no store provider still refreshes

- **GIVEN** a route under `app/app/layout.tsx` that mounts no store provider
- **WHEN** the window regains focus
- **THEN** the page SHALL refetch through `FocusRefresh`, so its server-rendered data is not left stale
