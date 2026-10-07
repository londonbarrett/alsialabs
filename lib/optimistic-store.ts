import { createStore, type StoreApi } from "zustand/vanilla"

type PendingItem<A> = {
  id: number
  action: A
}

type Reducer<S, A> = (state: S, action: A) => S

export type OptimisticStore<S, A, Seed = unknown> = {
  committed: S
  pending: PendingItem<A>[]
  /** committed with every pending action applied, in order. */
  optimistic: S
  pend: (action: A) => number
  commit: (id: number, action?: A) => void
  discard: (id: number) => void
  /**
   * Adopts newly fetched server data, keeping every pending action applied on
   * top of it.
   *
   * A provider seeds its store once, from props. `router.refresh()` re-runs the
   * server component and hands the provider fresh props, but client state
   * survives the refresh — so without this the seed is never re-read and a
   * refresh silently changes nothing. Replaying `pending` over the new base is
   * what makes this safe mid-edit: an in-flight optimistic write is not thrown
   * away by the refresh, and its server response still lands on top.
   *
   * `update` receives the current committed state rather than a replacement
   * because the server only owns part of it. Client-only slices — loaded
   * comments, expanded activity rows, fetched payments — have to survive, and
   * each store decides that from its own shape.
   */
  reseed: (update: (committed: S) => S) => void
  /**
   * Adopts the slice the server owns, through the `serverSlice` the store was
   * built with. It lives in state beside `reseed` because `createStore` puts
   * actions in the state the state creator returns: a method bolted onto the
   * API object is reachable neither through `getState()` nor through a
   * selector, which makes it a second, undocumented surface.
   *
   * Declared with method syntax so `OptimisticStore<S, A, Seed>` stays
   * assignable to `OptimisticStore<S, A>` — the state hooks and
   * `useOptimisticAction` annotate against the two-parameter form, and
   * methods are checked bivariantly where function-typed properties are not.
   */
  reseedFromServer(next: Seed): void
}

let nextPendingId = 1

/**
 * Builds a vanilla optimistic store (`StoreApi`), not a hook.
 *
 * These stores are scoped per provider instance and shared through React
 * context, which is why the Zustand v5 docs pair them with `useStore` for
 * reactive reads instead of `create`. `create` returns a *hook*, so calling it
 * outside render throws "Invalid hook call".
 *
 * `serverSlice` says which slice the server owns. Omit it for a store the
 * server sends whole: the seed replaces the committed state. Pass the
 * top-level key it lives under for a store whose state also carries
 * client-only fields loaded after mount — a reseed then replaces just that
 * key and the rest survives.
 */
export function createOptimisticStore<S, A, K extends keyof S>(config: {
  /** Committed state the store starts from, built by the provider from server props. */
  initialState: S
  /** Pure reducer; every optimistic transition (`pend`/`commit`/`discard`) routes through it. */
  reducer: Reducer<S, A>
  /** Top-level key of the slice the server owns, e.g. `"tasks"`. */
  serverSlice: K
}): StoreApi<OptimisticStore<S, A, S[K]>>

export function createOptimisticStore<S, A>(config: {
  /** Committed state the store starts from, built by the provider from server props. */
  initialState: S
  /** Pure reducer; every optimistic transition (`pend`/`commit`/`discard`) routes through it. */
  reducer: Reducer<S, A>
}): StoreApi<OptimisticStore<S, A, S>>

export function createOptimisticStore<S, A>(config: {
  initialState: S
  reducer: Reducer<S, A>
  serverSlice?: keyof S
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): StoreApi<OptimisticStore<S, A, any>> {
  const { initialState, reducer, serverSlice } = config
  const applySeed = serverSlice
    ? (committed: S, seed: unknown) =>
        ({ ...committed, [serverSlice]: seed }) as S
    : (_committed: S, seed: unknown) => seed as S
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createStore<OptimisticStore<S, A, any>>()((set) => {
    // Every state transition routes through here, so `optimistic` can never
    // drift from committed + pending.
    const settle = (committed: S, pending: PendingItem<A>[]) => ({
      committed,
      pending,
      optimistic: pending.reduce(
        (acc, item) => reducer(acc, item.action),
        committed
      ),
    })

    const reseed = (update: (committed: S) => S) =>
      set((state) => settle(update(state.committed), state.pending))

    return {
      committed: initialState,
      pending: [],
      optimistic: initialState,

      pend: (action) => {
        const id = nextPendingId++
        set((state) =>
          settle(state.committed, [...state.pending, { id, action }])
        )
        return id
      },

      commit: (id, overrideAction) =>
        set((state) => {
          const item = state.pending.find((p) => p.id === id)
          if (!item) return state
          const base = reducer(state.committed, item.action)
          return settle(
            overrideAction ? reducer(base, overrideAction) : base,
            state.pending.filter((p) => p.id !== id)
          )
        }),

      discard: (id) =>
        set((state) =>
          settle(
            state.committed,
            state.pending.filter((p) => p.id !== id)
          )
        ),

      reseed,

      reseedFromServer: (next) =>
        reseed((committed) => applySeed(committed, next)),
    }
  })
}

/**
 * A store that can adopt freshly fetched server data for the slice the server
 * owns. `useServerReseed` is typed against this, so only stores carrying a
 * reseed method qualify — `useState`'s setter cannot satisfy it.
 */
export type ServerSeededStore<S, A, Seed> = StoreApi<
  OptimisticStore<S, A, Seed>
>
