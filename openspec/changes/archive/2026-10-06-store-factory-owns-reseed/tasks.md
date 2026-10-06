## 1. Factory

- [x] 1.1 Add the required `applySeed: (committed: S, seed: Seed) => S` parameter to `createOptimisticStore` and thread `Seed` through as `OptimisticStore<S, A, Seed = unknown>`, declaring `reseedFromServer(next: Seed): void` with method syntax in the state shape
- [x] 1.2 Return `reseedFromServer` from the state creator, built from `applySeed`, beside `pend`/`commit`/`discard`/`reseed` — no `Object.assign`, no post-construction assignment anywhere in the file
- [x] 1.3 Re-type `ServerSeededStore<S, A, Seed>` as `StoreApi<OptimisticStore<S, A, Seed>>` and point `useServerReseed` at `store.getState().reseedFromServer(serverData)`

## 2. Store factories

- [x] 2.1 Convert all seven factories to `return createOptimisticStore(initialState, reducer, applySeed)`, moving the comment that explains which slice the server owns so it sits above `applySeed`: `my-tasks`, `project-tasks`, `activity`, `invoice`, `projects`, `project-context`, `timeline` (the last passing `(_, next) => sortTimelineEntries(next)`)
- [x] 2.2 Confirm no `Object.assign` remains anywhere under `stores/`
- [x] 2.3 Fix the stale `reseedContext` reference in the `project-context-store` doc comment — no such identifier exists; the provider reseeds through `useServerReseed`

## 3. Tests

- [x] 3.1 Update the eight `store.reseedFromServer(...)` call sites to `store.getState().reseedFromServer(...)`
- [x] 3.2 Give `makeStore` in `lib/optimistic-store.test.ts` the required `applySeed` and add coverage that `reseedFromServer` applies the declared merge, preserves the client-only slice, and replays pending actions
- [x] 3.3 `npx vitest run` passes

## 4. Specs

- [x] 4.1 MODIFIED delta for *A reseed adopts server data without discarding pending work*: the method is produced by the state creator from a required `applySeed`, plus a scenario for rejecting a factory built without it
- [x] 4.2 MODIFIED delta for *Stores are vanilla stores, never bound hooks*: declared return type gains `Seed`
- [x] 4.3 Confirm *Every store is read through one state hook* needs no delta — the code now complies with its existing `Object.assign` ban rather than changing it

## 5. Verify

- [x] 5.1 `npx tsc --noEmit` exits 0, which also proves the `Seed` default leaves the seven state hooks and `useOptimisticAction` compiling unchanged
- [x] 5.2 `grep -rn "Object.assign" stores/ lib/` returns nothing
- [x] 5.3 Targeted `npx eslint` shows only the pre-existing `hooks/use-mobile.ts:14` and `lib/actions/payments.test.ts:29`
- [x] 5.4 `npx playwright test e2e/my-tasks.spec.ts e2e/focus-refresh.spec.ts` stays at 4 passing — reseed is still reached on focus
