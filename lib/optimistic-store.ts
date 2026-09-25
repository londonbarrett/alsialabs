import { create } from "zustand"

export type PendingItem<A> = {
  id: number
  key?: string
  action: A
}

export type ApplyAction<S, A> = (
  state: S,
  key: string | undefined,
  action: A
) => S

export type OptimisticStore<S, A> = {
  committed: S
  pending: PendingItem<A>[]
  pend: (action: A, key?: string) => number
  commit: (id: number, action?: A) => void
  discard: (id: number) => void
  hydrate: (next: S) => void
  reset: () => void
}

interface CreateOptimisticStoreOptions<S> {
  /**
   * Return false to skip hydration when the server data is identical to
   * the current committed state (avoids clobbering in-flight optimistic
   * updates). The default always hydrates.
   */
  hydrateGuard?: (committed: S, next: S) => boolean
}

let nextPendingId = 1

export function createOptimisticStore<S, A>(
  initialState: S,
  applyAction: ApplyAction<S, A>,
  options: CreateOptimisticStoreOptions<S> = {}
) {
  return create<OptimisticStore<S, A>>((set) => ({
    committed: initialState,
    pending: [],

    pend: (action, key) => {
      const id = nextPendingId++
      set((state) => ({
        pending: [...state.pending, { id, key, action }],
      }))
      return id
    },

    commit: (id, overrideAction) =>
      set((state) => {
        const item = state.pending.find((p) => p.id === id)
        if (!item) return state
        // Always materialize the original pending action into committed,
        // then (optionally) apply the override on top — e.g. swapping a
        // temp entry for the real server-returned one.
        const base = applyAction(state.committed, item.key, item.action)
        return {
          committed: overrideAction
            ? applyAction(base, item.key, overrideAction)
            : base,
          pending: state.pending.filter((p) => p.id !== id),
        }
      }),

    discard: (id) =>
      set((state) => ({
        pending: state.pending.filter((p) => p.id !== id),
      })),

    hydrate: (next) =>
      set((state) => {
        // Never overwrite committed state while optimistic actions are
        // still in-flight — the pending queue would be lost.
        if (state.pending.length > 0) return state
        if (
          options.hydrateGuard &&
          !options.hydrateGuard(state.committed, next)
        )
          return state
        return { committed: next, pending: [] }
      }),

    reset: () => set({ committed: initialState, pending: [] }),
  }))
}