import { createStore } from "zustand/vanilla"

type PendingItem<A> = {
  id: number
  action: A
}

type ApplyAction<S, A> = (state: S, action: A) => S

export type OptimisticStore<S, A> = {
  committed: S
  pending: PendingItem<A>[]
  /** committed with every pending action applied, in order. */
  optimistic: S
  pend: (action: A) => number
  commit: (id: number, action?: A) => void
  discard: (id: number) => void
}

let nextPendingId = 1

/**
 * Builds a vanilla optimistic store (`StoreApi`), not a hook.
 *
 * These stores are scoped per provider instance and shared through React
 * context, which is why the Zustand v5 docs pair them with `useStore` for
 * reactive reads instead of `create`. `create` returns a *hook*, so calling it
 * outside render throws "Invalid hook call".
 */
export function createOptimisticStore<S, A>(
  initialState: S,
  applyAction: ApplyAction<S, A>
) {
  return createStore<OptimisticStore<S, A>>()((set) => {
    // Every state transition routes through here, so `optimistic` can never
    // drift from committed + pending.
    const settle = (committed: S, pending: PendingItem<A>[]) => ({
      committed,
      pending,
      optimistic: pending.reduce(
        (acc, item) => applyAction(acc, item.action),
        committed
      ),
    })

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
          const base = applyAction(state.committed, item.action)
          return settle(
            overrideAction ? applyAction(base, overrideAction) : base,
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

    }
  })
}
