import type { ClientActivity } from "@/lib/drizzle/schema"
import { type TimelineEntry } from "./timeline-reducer"
import { createTimelineStore } from "./timeline-store"
import { describe, expect, it } from "vitest"

function makeActivity(
  overrides: Partial<ClientActivity> = {}
): ClientActivity {
  return {
    id: "act-1",
    store_id: "store-1",
    clientId: "client-1",
    type: "note",
    subject: "Called client",
    description: null,
    activityDate: "2024-01-01",
    performedBy: "user-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } satisfies ClientActivity
}

function activityEntry(
  overrides: Partial<ClientActivity> = {}
): TimelineEntry {
  return { kind: "activity", ...makeActivity(overrides) }
}

describe("createTimelineStore", () => {
  it("seeds committed and optimistic from server entries", () => {
    const entries = [
      activityEntry({ id: "a" }),
      activityEntry({ id: "b" }),
    ]
    const store = createTimelineStore(entries)
    expect(store.getState().committed).toEqual(entries)
    expect(store.getState().optimistic).toEqual(entries)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("sorts seeded entries newest first", () => {
    const store = createTimelineStore([
      activityEntry({ id: "old", activityDate: "2024-01-01" }),
      activityEntry({ id: "new", activityDate: "2024-06-01" }),
    ])
    expect(store.getState().committed.map((e) => e.id)).toEqual([
      "new",
      "old",
    ])
  })

  it("delete removes by id only", () => {
    const store = createTimelineStore([
      activityEntry({ id: "a", activityDate: "2024-01-01" }),
      activityEntry({ id: "b", activityDate: "2024-06-01" }),
    ])
    const id = store.getState().pend({ type: "delete", id: "a" })
    expect(store.getState().optimistic.map((e) => e.id)).toEqual(["b"])
    store.getState().commit(id)
    expect(store.getState().committed.map((e) => e.id)).toEqual(["b"])
  })

  it("patch requires kind to target the right union member", () => {
    const store = createTimelineStore([
      activityEntry({ id: "a", subject: "before" }),
    ])
    const id = store.getState().pend({
      type: "patch",
      kind: "activity",
      id: "a",
      patch: { subject: "after" },
    })
    expect(store.getState().optimistic[0]).toMatchObject({
      kind: "activity",
      subject: "after",
    })
    store.getState().commit(id)
    expect(store.getState().committed[0]).toMatchObject({
      subject: "after",
    })
  })

  it("exposes getEntries without breaking the store's callable surface", () => {
    const store = createTimelineStore([activityEntry({ id: "a" })])
    // getEntries() itself subscribes via useSyncExternalStore, so it can only
    // be called from a React render. What matters here is that attaching the
    // method kept the store callable and getState reachable.
    expect(typeof store.getEntries).toBe("function")
    expect(typeof store).toBe("function")
    expect(store.getState().committed.map((e) => e.id)).toEqual(["a"])

    store.getState().pend({ type: "delete", id: "a" })
    expect(store.getState().optimistic).toEqual([])
  })
})
