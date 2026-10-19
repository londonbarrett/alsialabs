# Page-scoped optimistic state — Design

## Why this exists

List-heavy screens feel broken when every interaction waits on the network. The user edits a row, the spinner runs, and only then does the row change — and if the request fails, the change silently vanishes. This capability makes mutations render the instant they are issued and revert automatically if the server rejects them, so the UI always shows what the user just did without lying about what has been saved.

The hard part is not the optimistic render; it is everything around it. State must be scoped to a route visit rather than shared globally, seeded by the server component and yet able to adopt a fresh server response after `router.refresh()` without discarding work still in flight. Every domain must read and mutate its state the same way, and a mistake — a store used outside its provider, a reseed wired to the wrong thing — must fail loudly at build time or the boundary rather than degrade quietly in production.

The design answers this with one store contract (`committed`, `pending`, `optimistic`, plus `pend`/`commit`/`discard`/`reseed`/`reseedFromServer`), one construction pattern per provider, one state hook per store, one mutation path through `useOptimisticAction`, and one focus-refresh listener at the root of the authenticated layout.

## Goals

- Render pending mutations immediately and revert them automatically on failure.
- Scope each store to a single route visit, seeded by the server component that mounts its provider.
- Adopt fresh server data after `router.refresh()` without discarding pending work or client-only state.
- Give each domain one folder, one state hook, and one mutation path.
- Make misuse fail loudly — a throwing store hook, a typed reseed, no lint suppressions.

## Design

### The store contract

Optimistic client state lives in a Zustand store created per route visit, never in a module-level singleton and never threaded through props. The store exposes exactly `committed`, `pending`, `optimistic`, `pend`, `commit`, `discard`, `reseed`, and `reseedFromServer`. `optimistic` is never stored independently: whenever an action is pended, committed, or discarded, it is recomputed as `committed` with every pending action applied in order, so the optimistic view can never drift from the committed one. A failed mutation simply discards its pending action, and the previously committed state shows again.

There is deliberately no `hydrate` method, no `reset` action, and no client-keyed scope. Those would discard committed state wholesale rather than adopt server data on top of it, which is exactly the wrong shape once a store also carries client-only state. Mutations are the ordinary route for fresh server data; `reseed` exists only for the one case a mutation cannot cover — a `router.refresh()` triggered from outside the store, such as the window regaining focus.

Each store is built by a factory `createXStore(seed)`, which calls `createOptimisticStore` with a single config object — `{ initialState, reducer, serverSlice? }` — rather than positional arguments, so every factory names its inputs and the key naming the server's slice can never be confused with a merge callback. The generic store provides no `isSuccess`, `onSuccess`, or `onFailure` option: `useOptimisticAction` decides success with one shared heuristic and exposes only `commitAction`.

### One store per route visit, built by the page

Each store is published through an `XStoreContext` with a `useXStore()` hook that throws a provider-named error when no provider is mounted, so a missing provider fails loudly at the boundary instead of silently degrading. A component rendered on a route that does not mount the provider it needs fails the render immediately, naming the missing provider; leaving a route and returning remounts the provider and builds a fresh store seeded with newly fetched data.

Every provider builds its store with a lazy `useState` initializer — `const [store] = useState(() => createXStore(seed))` — and publishes it through the context. Providers never read `ref.current` during render: the `react-hooks/refs` rule forbids it, so the `useRef`-plus-null-check pattern is not used and no `eslint-disable` comment suppresses it. A page that re-renders with the same data does not rebuild or re-seed the store.

The provider is mounted by the route's page, not by the component that consumes the store. A consuming component is therefore a single component that calls `useXStore()` directly, rather than a wrapper that renders a provider around an inner content component. `TimelineProvider`, `ActivityProvider`, `InvoiceProvider`, `ProjectsProvider`, `ProjectTasksProvider`, `MyTasksProvider`, `ExpensesProvider`, and `RoutinesProvider` are each mounted by their page — `app/app/clientes/[clientId]/page.tsx`, `app/app/actividad/page.tsx`, `app/app/ventas/page.tsx`, `app/app/proyectos/page.tsx`, `app/app/proyectos/[id]/page.tsx`, `app/app/mis-tareas/page.tsx`, `app/app/proyectos/[id]/gastos/page.tsx`, and `app/app/proyectos/[id]/rutinas/page.tsx` respectively. A page mounts every provider its content reads, which is why the expenses page nests `ProjectTasksProvider` inside `ExpensesProvider` — the expenses table lists and edits task cost rows through the project tasks store.

### `useServerReseed` carries server props into the store

A lazy initializer runs once and client state survives `router.refresh()`, so a refresh would otherwise re-render the page with new props that nothing reads. Every provider therefore re-applies server data through `useServerReseed(store, serverData)`. The hook is typed against `ServerSeededStore<S, A, Seed>`, so it accepts only stores that carry `reseedFromServer`; a bare apply callback — or a `useState` setter, which has the wrong shape — fails to typecheck. TypeScript rejects the call rather than letting non-store state satisfy the hook.

Identity is the correct signal for "the server re-ran," because these props are built by the server component: a new reference means the server re-rendered, while client-only re-renders pass the same reference. No deep comparison is required. The store comes from a `useState` initializer and the data comes from props, so both are stable and no ref is needed to keep a callback fresh. A provider does not re-derive its reseed token during render — a token built inline changes identity every render and would reseed constantly — so the token is memoised or the prop is used directly. Reseeding happens in an effect, never during render, preserving the invariant that no render-phase write reaches the store its subscribers are reading, and provider files contain no `eslint-disable` comments.

Concretely, `MyTasksView` is mounted by `app/app/mis-tareas/page.tsx`; when the window regains focus, `useRefreshOnFocus` triggers `router.refresh()` and `MyTasksProvider` reseeds the store from the fresh `getMyTasks({})` result. An active status or project filter survives that refresh because the projection is derived from the store rather than fetched per filter, so the full task set reseeds underneath and the visible list stays narrowed the same way.

### Reseeding keeps pending work and client-only slices

`reseed(update)` sets committed state to `update(committed)` and recomputes `optimistic` as that result with every pending action applied in order. `update` receives the current committed state rather than a replacement value, because the server owns only part of the state: each store's reseed replaces the slice the server sent and preserves client-only slices — loaded task comments, expanded activity rows, fetched invoice payments — which a wholesale replacement would discard.

This is what lets an in-flight edit survive a refresh: a pending action and a refresh that returns data predating it leave the pending action applied over the new data and still pending until it commits or is discarded. A pending deletion is not undone by a server that hasn't processed it yet — the row stays hidden, and discarding the action falls back to the refreshed data. If a pending action is discarded after a reseed, the store shows the newly refreshed server data, not the pre-refresh data.

Each store factory exposes one method named `reseedFromServer(next)`, typed as `ServerSeededStore<S, A, Seed>`, so the merge sits beside the state shape, the method is referentially stable for effect dependencies, and one uniform name serves every store. `createOptimisticStore` builds that method in the state creator from the `serverSlice` its config declares: a reseed replaces that top-level key and leaves every other field untouched, which is all a partial store needs. A store whose state _is_ the server's slice — `createProjectsStore` or `createExpensesStore` — omits `serverSlice`, and a reseed then replaces committed state wholesale, while `createActivityStore` declares `serverSlice: "activities"` so its client-only fields survive. No factory passes a merge callback. The seed type is inferred from the declaration — `S[K]` for a slice key, `S` for a whole-state store — so a factory cannot name a slice of the wrong shape, and a partial store that forgets its `serverSlice` fails at compile time because `Seed` infers as the whole state while its provider passes a slice to `useServerReseed`. The method is never attached after construction with `Object.assign` or any other assignment, because a method bolted onto the API object is reachable through neither `getState()` nor a selector — a second, undocumented surface. A card never needs to pass a callback to `useRefreshOnFocus`, which continues to drive `router.refresh()` alone.

### Vanilla stores and two read styles

Every optimistic store is built by `createOptimisticStore` from `createStore` in `zustand/vanilla` and exposes the vanilla `StoreApi` surface: `getState`, `setState`, `getInitialState`, and `subscribe`. A store is never built with `create` from `zustand`, because `create` returns a React hook bound to the store; these stores are shared through context and read imperatively from async handlers, so a callable store invites calling a hook off the render path, which throws `Invalid hook call` at runtime instead of failing at build time. Inspected, a store is an object exposing the `StoreApi` methods and is not a function.

Reading follows one split. Reactive reads — the values a component renders — are selected with `useStore(store, selector)` during render and only from a state hook. Imperative reads — inside async handlers, action hooks, and tests — use `store.getState()`. A fetch helper such as `loadActivities` needs the entries already loaded for a client before appending the next page, so it reads through `store.getState()` or a store read method, never a hook. `createOptimisticStore` returns `StoreApi<OptimisticStore<S, A, Seed>>`, and `useOptimisticAction` accepts that `StoreApi` rather than a `UseBoundStore`.

### One state hook per store

Each optimistic store is read by components through exactly one state hook, `use[Store]State`, living beside the store it wraps: `useActivityState`, `useInvoiceState`, `useProjectsState`, `useTimelineState`, `useProjectContextState`, `useProjectTasksState`, `useExpensesState`, `useMyTasksState`, `useRoutinesState`. A state hook takes no arguments, is the only export of its file, and returns a single object of named values, so a consumer destructures what it needs in one call. Components never import a store directly and never select `s.optimistic` or `s.pending` themselves.

A state hook names each value for what it holds, not for where it sits in the store, and never aliases one value under two names: a store whose state already is the list returns it as `projects` or `entries`, never again as `optimistic`. The hook does not expose `committed`, which no consumer reads. Where a value needs a default or a derivation, the hook owns it — `useActivityState` supplies `EMPTY_ACTIVITIES` for a client with no activities yet, `useProjectsState` derives `pendingIds` from the pending queue, and `useProjectContextState` derives `primaryOwner` and `additionalOwners` from the owner list — so components never re-derive them.

A state hook holds no permissions. `useProjectContextState` returns role facts only — `project`, `projectId`, `owners`, `primaryOwner`, `additionalOwners`, `collaborators`, `members`, `categories`, `currentUserId`, `isCurrentUserAdmin`, `isOwner`, `isPrimaryOwner`, `isCollaborator` — and never `permissions`, `canEdit`, `canDelete`, or `canManageUsers`. A component composes its own capability from those facts plus `useHasPermission`, and every `useHasPermission` call is invoked unconditionally at the top level of render, never inside a boolean expression such as `isOwner && useHasPermission("projects:edit")`, because that calls a hook conditionally and breaks render order.

### One folder per domain

Everything belonging to one store lives in a single folder under `stores/`, named for the domain: `stores/activity/`, `stores/invoice/`, `stores/projects/`, `stores/project-context/`, `stores/project-tasks/`, `stores/expenses/`, `stores/timeline/`, `stores/my-tasks/`, `stores/routines/`. A folder holds that domain's reducer, store factory, store test, action hooks, and state hook together — `stores/invoice/` holds `invoice-reducer.ts`, `invoice-store.ts`, `sales-reducer.ts`, `payment-reducer.ts`, `use-invoice-actions.ts`, `use-invoice-state.ts`, and `use-payment-actions.ts`. A test sits beside the file it covers.

The shared `useOptimisticAction` stays at `stores/use-optimistic-action.ts` rather than in a domain folder or a shared subfolder, because it is infrastructure every domain uses rather than one domain's state. Payment state lives in `stores/invoice/` rather than a folder of its own, because payments have no store of their own — `salesReducer` composes `paymentReducer` into the invoice store's `SalesState`, and `usePaymentActions` writes to that store.

Modules inside one folder import each other relatively (`./invoice-reducer`); code outside `stores/` imports across folders absolutely (`@/stores/invoice/invoice-store`). No store folder imports another store folder, so each domain is self-contained and a change to how invoices are stored and mutated is found entirely inside `stores/invoice/`.

### `useOptimisticAction` runs every mutation

All optimistic mutations run through `useOptimisticAction` `stores/use-optimistic-action.ts`, which pends an action, runs the server mutation, then commits on success or discards on failure, and which drives the global loading bar — visible while a mutation is in flight and hidden once it settles. A caller may pass a `commitAction` to apply a second action after the original one commits, which is how a temporary row is swapped for the authoritative server row: a create that issued `replaceTemp` ends with the temp row replaced by the row the server saved, so later mutations target the real id. A `commitAction` callback may return `undefined` to skip the follow-up action, for a mutation whose server result only sometimes produces one — completing a recurring task spawns its next occurrence, but most completions do not.

`RunOptions` exposes `commitAction` only. `isSuccess`, `onSuccess`, and `onFailure` do not exist, because no caller passed them; the hook determines success with a single shared heuristic, `defaultIsSuccess` `lib/util/action-result.ts`, and leaves toasts to the caller.

### One success heuristic: `defaultIsSuccess`

`useOptimisticAction` decides whether a mutation succeeded with `defaultIsSuccess` `lib/util/action-result.ts`, and `useSettle` agrees with it, so the result that commits is the same result that toasts success. The heuristic treats a result as failure only when it carries evidence of failure — a next-safe-action `serverError` or `validationErrors`, or a store action's `success: false` — and treats every other result as success, including a missing result.

The missing-result case matters because a next-safe-action mutation that returns no value resolves to an empty object. A delete or a plain update the server completes successfully is therefore recognised as success and commits, and `useSettle` toasts its success message. A heuristic that required `data !== undefined` would misread a void success as a failure, discard the applied action, and show an error — while the mutation has already landed on the server, so the row reappears on the next fetch. A result carrying `{ serverError }` or `{ validationErrors }` still reverts, and a store action reporting `{ success: false, error }` reverts and toasts the error.

### Settling outcomes: `useSettle` and handler returns

Every action hook — `useInvoiceActions`, `useTimelineActions`, `useActivityActions`, `usePaymentActions`, `useProjectActions`, `useProjectsActions`, `useProjectPeopleActions`, `useProjectTasksActions`, `useExpensesActions`, `useMyTasksActions`, `useRoutinesActions` — reports each mutation through the shared `useSettle` hook `hooks/use-settle.ts`, which toasts the translated `serverError`, returns `validationErrors` for the form to render without toasting, toasts a success message otherwise, and returns a `SettleResult` `lib/types.ts`. A handler returns `SettleResult` only when its caller consumes the outcome: the invoice `createInvoice`/`updateInvoice` handlers return it so `InvoiceForm` can render the returned `fieldErrors`, and every other handler returns `void`, because no caller reads the outcome. A fire-and-forget handler still owns its success or error toast via `useSettle`; it just returns nothing.

Fetch helpers are not mutations. `loadPayments` `stores/invoice/use-payment-actions.ts` and `loadActivities` `stores/activity/use-activity-actions.ts` return `void`, pend and commit the store directly, and do not drive the loading bar or toast a success, because reading a list is not a mutation.

### Focus refresh is registered once, at the root

The application registers focus-driven refresh in exactly one place: the `FocusRefresh` client component, which calls `useRefreshOnFocus()` and renders nothing, mounted once by `app/app/layout.tsx`. Because `router.refresh()` re-runs the whole route tree, a single listener at the root supplies fresh seed props to every provider mounted beneath it — one listener is both necessary and sufficient. A focus event therefore issues exactly one `router.refresh()`, and every mounted store provider reseeds from its result.

Store providers do not call `useRefreshOnFocus`, nor do components that render store content. A per-provider owner would force a decision on any route that mounts more than one provider — `app/app/proyectos/[id]` mounts `ProjectContextProvider` around `ProjectTasksProvider` — and the loser of that decision needs a comment recording its silence, a rule the code only keeps because a comment says so. Neither provider registers a `visibilitychange` listener, and the route still refreshes exactly once through `FocusRefresh`. With no owner inside the tree, no second listener can be added by accident, and the request count does not depend on which cards a page happens to render. Consumers such as `MyTasksView`, `ActivityTimeline`, `RemindersCard`, `InactiveClientsCard`, and `TasksCard` render without requesting a refresh; their pages refresh on focus through the root layout.

A route refreshes on focus whether or not it mounts a store provider, because the layout wraps every authenticated route: server-rendered data on a page with no store goes stale for the same reason and is recovered the same way.

## Non-goals

- `reset` or `hydrate` actions, or any wholesale clearing of committed state. Server data is adopted on top of committed state through reseed.
- Module-level singleton stores or optimistic state threaded through props.
- Per-provider or per-card focus listeners. Refresh is registered once at the root layout.
- An `isSuccess`, `onSuccess`, or `onFailure` option on the generic store or on `RunOptions`. Success is decided by one shared heuristic.
- Deep comparison of server seed props. Reference identity is the signal that the server re-ran.
- State hooks that answer permission questions. They return role facts; components combine those with `useHasPermission`.
- Cross-store imports between domain folders, and building a store with `create` from `zustand` or calling a store as a function.
