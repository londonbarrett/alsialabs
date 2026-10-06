import { describe, expect, it } from "vitest"
import { createOptimisticStore } from "./optimistic-store"

type Counter = { items: number[]; clientOnly: string }

type CounterAction =
  | { type: "add"; value: number }
  | { type: "remove"; value: number }

function counterReducer(
  state: Counter,
  action: CounterAction
): Counter {
  switch (action.type) {
    case "add":
      return { ...state, items: [...state.items, action.value] }
    case "remove":
      return {
        ...state,
        items: state.items.filter((v) => v !== action.value),
      }
  }
}

function makeStore(items: number[] = [1, 2]) {
  return createOptimisticStore<Counter, CounterAction, number[]>(
    { items, clientOnly: "loaded" },
    counterReducer,
    (committed, next) => ({ ...committed, items: next })
  )
}

describe("createOptimisticStore reseed", () => {
  it("replaces the slice the updater returns", () => {
    const store = makeStore([1, 2])
    store.getState().reseed((committed) => ({
      ...committed,
      items: [7, 8, 9],
    }))

    expect(store.getState().committed.items).toEqual([7, 8, 9])
    expect(store.getState().optimistic.items).toEqual([7, 8, 9])
  })

  it("leaves state the updater does not touch alone", () => {
    const store = makeStore()
    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [7] }))

    // This is the client-only slice: a reseed that replaced the whole state
    // would drop it.
    expect(store.getState().committed.clientOnly).toBe("loaded")
  })

  it("replays pending actions over the new base instead of dropping them", () => {
    const store = makeStore([1, 2])
    const id = store.getState().pend({ type: "add", value: 3 })

    // A focus refresh lands mid-edit: the server has not seen `add 3` yet.
    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [1, 2] }))

    expect(store.getState().optimistic.items).toEqual([1, 2, 3])
    expect(store.getState().pending).toHaveLength(1)

    store.getState().commit(id)
    expect(store.getState().committed.items).toEqual([1, 2, 3])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("keeps a pending removal hidden when the server still has the row", () => {
    const store = makeStore([1, 2, 3])
    const id = store.getState().pend({ type: "remove", value: 2 })

    // The server has not processed the delete yet, so it still sends the row.
    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [1, 2, 3] }))

    expect(store.getState().optimistic.items).toEqual([1, 3])

    store.getState().discard(id)
    // Discarding after a reseed falls back to the refreshed server data.
    expect(store.getState().optimistic.items).toEqual([1, 2, 3])
  })

  it("applies pending actions in order", () => {
    const store = makeStore([1])
    const first = store.getState().pend({ type: "add", value: 2 })
    store.getState().pend({ type: "add", value: 3 })

    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [1] }))

    expect(store.getState().optimistic.items).toEqual([1, 2, 3])
    store.getState().discard(first)
    expect(store.getState().optimistic.items).toEqual([1, 3])
  })

  it("notifies subscribers so the UI re-renders", () => {
    const store = makeStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)

    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [5] }))

    unsubscribe()
    expect(calls).toBe(1)
  })

  it("is a no-op on pending state when nothing is in flight", () => {
    const store = makeStore([1, 2])
    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [3] }))
    store
      .getState()
      .reseed((committed) => ({ ...committed, items: [4] }))

    expect(store.getState().pending).toEqual([])
    expect(store.getState().committed.items).toEqual([4])
  })
})

describe("createOptimisticStore reseedFromServer", () => {
  it("applies the seed merge the store was built with", () => {
    const store = makeStore([1, 2])
    store.getState().reseedFromServer([7, 8, 9])

    expect(store.getState().committed.items).toEqual([7, 8, 9])
    expect(store.getState().optimistic.items).toEqual([7, 8, 9])
  })

  it("gives the merge committed state, so the client-only slice survives", () => {
    const store = makeStore([1, 2])
    store.getState().reseedFromServer([9])

    // A replacement value would have dropped this; the merge receives the
    // current committed state and returns what the server owns.
    expect(store.getState().committed.clientOnly).toBe("loaded")
  })

  it("replays pending actions over the reseeded base", () => {
    const store = makeStore([1, 2])
    store.getState().pend({ type: "add", value: 3 })

    // A focus refresh lands before the server has seen the pending write.
    store.getState().reseedFromServer([1, 2])

    expect(store.getState().optimistic.items).toEqual([1, 2, 3])
    expect(store.getState().pending).toHaveLength(1)
  })

  it("lives in state, so getState() reaches it", () => {
    const store = makeStore()

    // Not bolted onto the API object: a post-construction assignment is
    // reachable through neither getState() nor a selector.
    expect(typeof store.getState().reseedFromServer).toBe("function")
    expect(store.getState().reseedFromServer).toBe(
      store.getState().reseedFromServer
    )
  })
})