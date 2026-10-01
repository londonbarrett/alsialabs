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

### Requirement: Optimistic reads go through store read methods

Components and hooks SHALL NOT select `s.optimistic` or `s.pending` directly. Each LIST-shaped store factory SHALL attach named read methods with `Object.assign` (`getEntries` `stores/timeline-store.ts`, `getInvoices` `stores/invoice-store.ts`, `getReminders`/`getClientActivities` `stores/activity-store.ts`, `getProjects`/`getPending` `stores/projects-store.ts`) so a component expresses intent rather than store layout. A read method calls a Zustand hook internally, so it SHALL be invoked unconditionally at the top level of render.

The single-object project context store `stores/project-context-store.ts` SHALL NOT need read methods, because its consumers read derived data — `project`, `owners`, `collaborators`, `permissions`, `canEdit` and so on — through `useProjectContext` `stores/use-project-context.ts`, which is a richer hook over one object rather than a list.

#### Scenario: A component reads without knowing the store layout

- **WHEN** a component needs the current list
- **THEN** it SHALL call the store's `get*` read method and SHALL NOT destructure store internals

### Requirement: Mutations run through one action hook

All optimistic mutations SHALL run through `useOptimisticAction` `stores/use-optimistic-action.ts`, which pends an action, runs the server mutation, then commits on success or discards on failure, and which drives both the global loading bar and a local `isPending` flag. A caller MAY pass a `commitAction` to apply a second action after the original one commits — used to swap a temporary row for the authoritative server row, or to `replaceTemp` a row the server has just saved.

`RunOptions` SHALL expose `commitAction` only. `isSuccess`, `onSuccess`, and `onFailure` SHALL NOT exist, because no caller passed them; the hook SHALL determine success with a single shared heuristic and SHALL leave toasts to the caller.

#### Scenario: Temporary row is swapped for the saved row

- **WHEN** a create mutation succeeds and the caller passes a `commitAction` issuing `replaceTemp`
- **THEN** the temporary row SHALL be replaced by the row the server saved, so later mutations target the real id

#### Scenario: Loading bar is driven by the mutation

- **WHEN** an optimistic mutation is in flight
- **THEN** the global loading bar SHALL be visible and SHALL hide once it settles
