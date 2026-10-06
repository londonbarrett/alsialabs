import type { Reminder } from "@/lib/actions/reminders"
import type { ClientTimelineEntry } from "@/lib/actions/client-timeline"
import {
  activityReducer,
  type ClientActivityList,
  type ActivityState,
} from "./activity-reducer"
import { createActivityStore } from "./activity-store"
import { describe, expect, it } from "vitest"

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "rem-1",
    clientId: "client-1",
    clientName: "Ada",
    description: "Call back",
    remindAt: "2024-06-01",
    completed: false,
    ...overrides,
  } as Reminder
}

function makeEntry(
  overrides: Partial<
    Extract<ClientTimelineEntry, { kind: "reminder" }>
  > = {}
): ClientTimelineEntry {
  return {
    kind: "reminder",
    id: "rem-1",
    clientId: "client-1",
    description: "Call back",
    remindAt: "2024-06-01",
    completed: false,
    ...overrides,
  } as ClientTimelineEntry
}

function seeded(reminders: Reminder[] = []): ActivityState {
  return { reminders, activities: {} }
}

describe("activityReducer reminders", () => {
  it("addReminder prepends a temp row", () => {
    const a = makeReminder({ id: "a" })
    const temp = makeReminder({ id: "temp-1", description: "New" })
    expect(
      activityReducer(seeded([a]), {
        type: "addReminder",
        reminder: temp,
      }).reminders
    ).toEqual([temp, a])
  })

  it("addReminder leaves activities alone when no activities client is given", () => {
    const state = activityReducer(seeded(), {
      type: "addReminder",
      reminder: makeReminder({ id: "a" }),
    })
    expect(state.activities).toEqual({})
  })

  it("addReminder also adds to the activities when activityClientId is given", () => {
    const state = activityReducer(seeded(), {
      type: "addReminder",
      reminder: makeReminder({ id: "a" }),
      activityClientId: "client-1",
    })
    expect(state.activities["client-1"].entries).toHaveLength(1)
    expect(state.activities["client-1"].entries[0]).toMatchObject({
      kind: "reminder",
      id: "a",
      description: "Call back",
    })
  })

  it("addReminder writes to the named activities only", () => {
    const state: ActivityState = {
      reminders: [],
      activities: {
        "client-2": {
          entries: [makeEntry({ id: "other" })],
          hasMore: false,
          loaded: true,
        },
      },
    }
    const next = activityReducer(state, {
      type: "addReminder",
      reminder: makeReminder({ id: "a" }),
      activityClientId: "client-1",
    })
    expect(next.activities["client-2"].entries).toHaveLength(1)
    expect(next.activities["client-1"].entries).toHaveLength(1)
  })

  it("replaceTempReminder swaps the temp row in both lists", () => {
    const temp = makeReminder({ id: "temp-1" })
    const saved = makeReminder({ id: "real-1" })
    const state: ActivityState = {
      reminders: [temp],
      activities: {
        "client-1": {
          entries: [makeEntry({ id: "temp-1" })],
          hasMore: false,
          loaded: true,
        },
      },
    }
    const next = activityReducer(state, {
      type: "replaceTempReminder",
      tempId: "temp-1",
      reminder: saved,
      activityClientId: "client-1",
    })
    expect(next.reminders).toEqual([saved])
    expect(next.activities["client-1"].entries[0].id).toBe("real-1")
  })

  it("completeReminder marks done instead of removing", () => {
    const a = makeReminder({ id: "a" })
    expect(
      activityReducer(seeded([a]), {
        type: "completeReminder",
        id: "a",
      }).reminders
    ).toEqual([{ ...a, completed: true }])
  })

  it("patchReminder merges fields", () => {
    const a = makeReminder({ id: "a" })
    expect(
      activityReducer(seeded([a]), {
        type: "patchReminder",
        id: "a",
        patch: { description: "changed" },
      }).reminders
    ).toEqual([{ ...a, description: "changed" }])
  })

  it("deleteReminder filters by id", () => {
    const a = makeReminder({ id: "a" })
    const b = makeReminder({ id: "b" })
    expect(
      activityReducer(seeded([a, b]), {
        type: "deleteReminder",
        id: "a",
      }).reminders
    ).toEqual([b])
  })
})

describe("activityReducer activities", () => {
  const activities: ClientActivityList = {
    entries: [],
    hasMore: false,
    loaded: true,
  }

  it("setClientActivity marks the activities loaded", () => {
    const next = activityReducer(
      { reminders: [], activities: { "client-1": activities } },
      {
        type: "setClientActivity",
        clientId: "client-1",
        entries: [makeEntry()],
        hasMore: true,
      }
    )
    expect(next.activities["client-1"]).toEqual({
      entries: [makeEntry()],
      hasMore: true,
      loaded: true,
    })
  })

  it("setClientActivity creates a activities for a client that had none", () => {
    const next = activityReducer(seeded(), {
      type: "setClientActivity",
      clientId: "client-1",
      entries: [],
      hasMore: false,
    })
    expect(next.activities["client-1"]).toEqual({
      entries: [],
      hasMore: false,
      loaded: true,
    })
  })

  it("addClientActivity prepends", () => {
    const existing = makeEntry({ id: "old" })
    const next = activityReducer(
      {
        reminders: [],
        activities: {
          "client-1": { ...activities, entries: [existing] },
        },
      },
      {
        type: "addClientActivity",
        clientId: "client-1",
        entry: makeEntry({ id: "new" }),
      }
    )
    expect(
      next.activities["client-1"].entries.map((e) => e.id)
    ).toEqual(["new", "old"])
  })

  it("patchClientActivity only patches the matching kind", () => {
    const reminder = makeEntry({ id: "rem-1" })
    const next = activityReducer(
      {
        reminders: [],
        activities: {
          "client-1": { ...activities, entries: [reminder] },
        },
      },
      {
        type: "patchClientActivity",
        clientId: "client-1",
        kind: "activity",
        id: "rem-1",
        patch: { subject: "nope" } as never,
      }
    )
    expect(next.activities["client-1"].entries[0]).toEqual(reminder)
  })

  it("deleteClientActivity filters by id", () => {
    const next = activityReducer(
      {
        reminders: [],
        activities: {
          "client-1": {
            ...activities,
            entries: [makeEntry({ id: "a" }), makeEntry({ id: "b" })],
          },
        },
      },
      { type: "deleteClientActivity", clientId: "client-1", id: "a" }
    )
    expect(
      next.activities["client-1"].entries.map((e) => e.id)
    ).toEqual(["b"])
  })

  // A card row dispatches these three without naming a client, so they have to
  // reach whichever expanded row is also showing the reminder.
  describe("reminder actions reach every activities", () => {
    const state = {
      reminders: [makeReminder({ id: "rem-1" })],
      activities: {
        "client-1": {
          entries: [
            makeEntry({ id: "rem-1" }),
            makeEntry({ id: "other" }),
          ],
          hasMore: false,
          loaded: true,
        },
        "client-2": {
          entries: [makeEntry({ id: "rem-1" })],
          hasMore: false,
          loaded: true,
        },
      },
    }

    it("completeReminder marks the activities entry completed too", () => {
      const next = activityReducer(state, {
        type: "completeReminder",
        id: "rem-1",
      })
      expect(next.activities["client-1"].entries[0]).toMatchObject({
        id: "rem-1",
        completed: true,
      })
      expect(next.activities["client-2"].entries[0]).toMatchObject({
        completed: true,
      })
    })

    it("patchReminder merges into the activities entry too", () => {
      const next = activityReducer(state, {
        type: "patchReminder",
        id: "rem-1",
        patch: { description: "changed" },
      })
      expect(next.activities["client-1"].entries[0]).toMatchObject({
        description: "changed",
      })
    })

    it("deleteReminder drops the entry from every activities", () => {
      const next = activityReducer(state, {
        type: "deleteReminder",
        id: "rem-1",
      })
      expect(
        next.activities["client-1"].entries.map((e) => e.id)
      ).toEqual(["other"])
      expect(next.activities["client-2"].entries).toEqual([])
    })

    it("leaves entries with a different id untouched", () => {
      const next = activityReducer(state, {
        type: "completeReminder",
        id: "rem-1",
      })
      expect(next.activities["client-1"].entries[1]).toEqual(
        makeEntry({ id: "other" })
      )
    })
  })
})

describe("createActivityStore", () => {
  it("seeds committed and optimistic from server reminders", () => {
    const a = makeReminder({ id: "a" })
    const store = createActivityStore([a])
    expect(store.getState().committed.reminders).toEqual([a])
    expect(store.getState().optimistic.reminders).toEqual([a])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend then commit applies the action to committed", () => {
    const a = makeReminder({ id: "a" })
    const store = createActivityStore([a])
    const id = store
      .getState()
      .pend({ type: "completeReminder", id: "a" })
    expect(store.getState().committed.reminders[0].completed).toBe(
      false
    )
    expect(store.getState().optimistic.reminders[0].completed).toBe(
      true
    )
    store.getState().commit(id)
    expect(store.getState().committed.reminders[0].completed).toBe(true)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("discard reverts without committing", () => {
    const a = makeReminder({ id: "a" })
    const store = createActivityStore([a])
    const id = store
      .getState()
      .pend({ type: "deleteReminder", id: "a" })
    expect(store.getState().optimistic.reminders).toEqual([])
    store.getState().discard(id)
    expect(store.getState().committed.reminders).toEqual([a])
  })

  it("exposes the plain vanilla store API", () => {
    const store = createActivityStore([makeReminder({ id: "a" })])
    // The store is a vanilla StoreApi object, not a hook. If it ever becomes
    // callable again, imperative reads throw "Invalid hook call" off render.
    expect(typeof store).toBe("object")
    expect(typeof store.getState).toBe("function")
    expect(typeof store.setState).toBe("function")
    expect(typeof store.subscribe).toBe("function")
    // Every action lives in state, per the createStore docs — nothing is
    // bolted onto the API object with Object.assign.
    expect(typeof store.getState().pend).toBe("function")
    expect(typeof store.getState().commit).toBe("function")
    expect(typeof store.getState().discard).toBe("function")
    expect(store.getState().committed.reminders).toHaveLength(1)
  })

  it("reads imperatively outside React without throwing", () => {
    // Reads off the render path go through getState() on the vanilla store.
    const store = createActivityStore([makeReminder({ id: "a" })])
    expect(store.getState().optimistic.reminders).toEqual([
      makeReminder({ id: "a" }),
    ])
    // This is how loadActivities reads a client's entries before appending.
    expect(store.getState().optimistic.activities["client-1"]).toBeUndefined()
  })

  it("holds the stored list for an expanded client", () => {
    const store = createActivityStore([])
    const entry = makeEntry()
    const id = store.getState().pend({
      type: "setClientActivity",
      clientId: "client-1",
      entries: [entry],
      hasMore: false,
    })
    store.getState().commit(id)
    expect(store.getState().optimistic.activities["client-1"]).toEqual({
      entries: [entry],
      hasMore: false,
      loaded: true,
    })
  })

  it("leaves no activities behind for clients that were never expanded", () => {
    // The shared EMPTY_ACTIVITIES fallback stays reachable because the store
    // holds nothing for a client that was never expanded.
    const store = createActivityStore([])
    expect(store.getState().optimistic.activities).toEqual({})
  })
})
