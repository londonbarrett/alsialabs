import { describe, it, expect } from "vitest"
import type { RoutineWithAssignee } from "@/lib/types"
import { routinesReducer } from "./routines-reducer"
import { createRoutinesStore } from "./routines-store"

function makeRoutine(
  overrides: Partial<RoutineWithAssignee> = {}
): RoutineWithAssignee {
  return {
    id: "routine-1",
    projectId: "project-1",
    name: "Irrigation",
    description: null,
    cost: null,
    recurrence: "daily",
    interval: 1,
    daysOfWeek: null,
    time: "08:00",
    startDate: null,
    endDate: null,
    assigneeId: null,
    assigneeName: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  }
}

describe("routinesReducer", () => {
  const a = makeRoutine({ id: "a", name: "A" })
  const b = makeRoutine({ id: "b", name: "B" })

  it("adds routine to front", () => {
    expect(routinesReducer([a], { type: "add", routine: b })).toEqual([
      b,
      a,
    ])
  })

  it("updates routine", () => {
    const updated = makeRoutine({ id: "a", name: "New" })
    expect(
      routinesReducer([a, b], { type: "update", routine: updated })[0].name
    ).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeRoutine({ id: "temp-1" })
    const real = makeRoutine({ id: "real-1" })
    expect(
      routinesReducer([temp, a], {
        type: "replaceTemp",
        tempId: "temp-1",
        routine: real,
      })
    ).toEqual([real, a])
  })

  it("deletes routine", () => {
    expect(
      routinesReducer([a, b], { type: "delete", routineId: "a" })
    ).toEqual([b])
  })
})

describe("createRoutinesStore", () => {
  it("seeds committed and optimistic from server props", () => {
    const a = makeRoutine({ id: "a" })
    const b = makeRoutine({ id: "b" })
    const store = createRoutinesStore([a, b])
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().optimistic).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend leaves committed untouched; commit applies the action", () => {
    const a = makeRoutine({ id: "a" })
    const b = makeRoutine({ id: "b" })
    const store = createRoutinesStore([a])
    const id = store.getState().pend({ type: "add", routine: b })
    expect(store.getState().committed).toEqual([a])
    expect(store.getState().optimistic[0].id).toBe("b")
    store.getState().commit(id)
    expect(store.getState().committed[0].id).toBe("b")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit supports a replacement action", () => {
    const a = makeRoutine({ id: "a" })
    const temp = makeRoutine({ id: "temp-1" })
    const real = makeRoutine({ id: "real-1" })
    const store = createRoutinesStore([a])
    const id = store.getState().pend({ type: "add", routine: temp })
    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1",
      routine: real,
    })
    expect(store.getState().committed).toEqual([real, a])
  })

  it("discard reverts a failed create", () => {
    const a = makeRoutine({ id: "a" })
    const temp = makeRoutine({ id: "temp-1" })
    const store = createRoutinesStore([a])
    const id = store.getState().pend({ type: "add", routine: temp })
    store.getState().discard(id)
    expect(store.getState().committed).toEqual([a])
    expect(store.getState().optimistic).toEqual([a])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("discard restores a row whose delete failed", () => {
    const a = makeRoutine({ id: "a" })
    const b = makeRoutine({ id: "b" })
    const store = createRoutinesStore([a, b])
    const id = store.getState().pend({ type: "delete", routineId: "a" })
    expect(store.getState().optimistic).toEqual([b])
    store.getState().discard(id)
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().optimistic).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("reseedFromServer replaces the whole committed list", () => {
    const a = makeRoutine({ id: "a" })
    const b = makeRoutine({ id: "b" })
    const store = createRoutinesStore([a])
    store.getState().reseedFromServer([b])
    expect(store.getState().committed).toEqual([b])
    expect(store.getState().optimistic).toEqual([b])
  })

  it("a pending delete survives a reseed that still returns the row", () => {
    const a = makeRoutine({ id: "a" })
    const b = makeRoutine({ id: "b" })
    const store = createRoutinesStore([a, b])
    const id = store.getState().pend({ type: "delete", routineId: "a" })
    store.getState().reseedFromServer([a, b])
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().optimistic).toEqual([b])
    store.getState().discard(id)
    expect(store.getState().optimistic).toEqual([a, b])
  })
})
