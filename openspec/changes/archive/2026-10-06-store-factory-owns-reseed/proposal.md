## Why

`optimistic-state` has forbidden this pattern since before this session — under *Every store is read through one state hook*:

> No store SHALL attach methods with `Object.assign` or any other post-construction assignment: … a method bolted onto the API object is reachable neither through `getState()` nor through a selector, which makes it a second, undocumented surface. `createActivityStore`, … SHALL therefore each return `createOptimisticStore(...)` directly and uniformly.

`git show HEAD` confirms the stores complied: no `Object.assign`, no `reseedFromServer`. The whole reseed machinery is new in this session, and wiring it in by attaching the method to seven stores reintroduced exactly the shape the rule bans — while this session's own spec edit *added* `createProjectTasksStore` to the list of factories that must return `createOptimisticStore(...)` directly, naming a store whose code does the opposite. Nothing detected the mismatch because no check compares spec text to code.

So the fix is not cosmetic: build the method where the other actions are built, in the state creator, and require every factory to say which slice the server owns.

## What Changes

- `createOptimisticStore(initialState, applyAction, applySeed)` gains a **required** third argument `applySeed: (committed: S, seed: Seed) => S`. A store cannot be constructed without declaring the server's slice, which is the "reload tolerant by default" property the factory now guarantees.
- `reseedFromServer` becomes part of the state returned by the state creator, beside `pend`, `commit`, `discard`, and `reseed`, so it is reachable through `getState()` like every other action instead of sitting on the API object.
- `OptimisticStore<S, A>` becomes `OptimisticStore<S, A, Seed = unknown>`. The default keeps the seven state hooks and `useOptimisticAction` untouched, and declaring `reseedFromServer` with method syntax keeps their `StoreType = OptimisticStore<S, A>` annotations assignable under `strictFunctionTypes`.
- `ServerSeededStore<S, A, Seed>` is now just `StoreApi<OptimisticStore<S, A, Seed>>`; `useServerReseed` calls `store.getState().reseedFromServer(next)`.
- All seven factories return `createOptimisticStore(...)` directly — no `Object.assign`, and the per-domain comment about which slice the server owns moves to sit above the `applySeed` argument.

## Capabilities

### Modified Capabilities

- `optimistic-state` / *A reseed adopts server data without discarding pending work*: records that the method is produced by the state creator from a required `applySeed`, and adds a scenario for the compile-time rejection of a factory built without it.
- `optimistic-state` / *Stores are vanilla stores, never bound hooks*: the declared return type gains `Seed`.

## Impact

- Affected code: `lib/optimistic-store.ts`, `hooks/use-server-reseed.ts`, the seven `*-store.ts` files, and the eight `store.reseedFromServer(...)` call sites in `stores/my-tasks/my-tasks-store.test.ts` and `stores/project-tasks/project-tasks-store.test.ts`, which become `store.getState().reseedFromServer(...)` like every other action call.
- `lib/optimistic-store.test.ts` gains the required `applySeed` and coverage for `reseedFromServer` itself.
- No behaviour change: the merge, the pending replay, and the seed-identity skip in `useServerReseed` are all untouched. No DB, server-action, or i18n change.
