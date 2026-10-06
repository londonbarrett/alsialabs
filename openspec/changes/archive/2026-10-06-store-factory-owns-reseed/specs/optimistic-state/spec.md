## MODIFIED Requirements

### Requirement: A reseed adopts server data without discarding pending work

`reseed(update)` SHALL set committed state to `update(committed)` and SHALL recompute `optimistic` as that result with every pending action applied in order, so an in-flight optimistic write survives the refresh and its server response still lands on top. `update` SHALL receive the current committed state rather than a replacement value, because the server owns only part of the state: each store's reseed method SHALL replace the slice the server sent and preserve client-only slices — loaded task comments, expanded activity rows, fetched invoice payments — which a wholesale replacement would discard.

Each store factory SHALL expose one method named `reseedFromServer(next)` that takes the new server data, typed as `ServerSeededStore<S, A, Seed>`, so the merge sits beside the state shape, the method is referentially stable for effect dependencies, and one uniform name serves every store. `createOptimisticStore` SHALL build that method in the state creator, from an `applySeed(committed, seed)` argument every factory MUST supply, so a store cannot be constructed without declaring the slice the server owns — reload tolerance is then a property of the factory rather than a line each provider has to remember. The method SHALL NOT be attached after construction with `Object.assign` or any other assignment, because a method bolted onto the API object is reachable through neither `getState()` nor a selector, making it a second, undocumented surface. A card SHALL NOT need to pass a callback to `useRefreshOnFocus`, which SHALL continue to drive `router.refresh()` alone.

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

#### Scenario: A store cannot be built without declaring the server's slice

- **WHEN** `createOptimisticStore` is called without its `applySeed` argument
- **THEN** TypeScript SHALL reject the call, because a store that does not know which slice the server owns cannot reseed the data a refresh delivers

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
