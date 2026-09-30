import type { Reminder } from "@/lib/actions/reminders"
import {
  createRemindersStore,
  remindersReducer,
} from "./reminders-store"
import { describe, expect, it } from "vitest"

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: "rem-1",
    clientId: "client-1",
    description: "Call back",
    remindAt: "2024-06-01",
    completed: false,
    ...overrides,
  } as Reminder
}

describe("remindersReducer", () => {
  it("add prepends a temp row", () => {
    const a = makeReminder({ id: "a" })
    const temp = makeReminder({ id: "temp-1", description: "New" })
    expect(
      remindersReducer([a], { type: "add", reminder: temp })
    ).toEqual([temp, a])
  })

  it("replaceTemp swaps the temp row for the saved one", () => {
    const a = makeReminder({ id: "temp-1" })
    const saved = makeReminder({ id: "real-1" })
    expect(
      remindersReducer([a], {
        type: "replaceTemp",
        tempId: "temp-1",
        reminder: saved,
      })
    ).toEqual([saved])
  })

  it("replaceTemp leaves other rows alone", () => {
    const a = makeReminder({ id: "a" })
    const temp = makeReminder({ id: "temp-1" })
    const saved = makeReminder({ id: "real-1" })
    expect(
      remindersReducer([a, temp], {
        type: "replaceTemp",
        tempId: "temp-1",
        reminder: saved,
      })
    ).toEqual([a, saved])
  })

  it("complete marks done instead of removing", () => {
    const a = makeReminder({ id: "a" })
    expect(
      remindersReducer([a], { type: "complete", id: "a" })
    ).toEqual([{ ...a, completed: true }])
  })

  it("patch merges fields", () => {
    const a = makeReminder({ id: "a" })
    expect(
      remindersReducer([a], {
        type: "patch",
        id: "a",
        patch: { description: "changed" },
      })
    ).toEqual([{ ...a, description: "changed" }])
  })

  it("delete filters by id", () => {
    const a = makeReminder({ id: "a" })
    const b = makeReminder({ id: "b" })
    expect(
      remindersReducer([a, b], { type: "delete", id: "a" })
    ).toEqual([b])
  })
})

describe("createRemindersStore", () => {
  it("seeds committed and optimistic from server reminders", () => {
    const a = makeReminder({ id: "a" })
    const store = createRemindersStore([a])
    expect(store.getState().committed).toEqual([a])
    expect(store.getState().optimistic).toEqual([a])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend then commit applies the action to committed", () => {
    const a = makeReminder({ id: "a" })
    const store = createRemindersStore([a])
    const id = store.getState().pend({ type: "complete", id: "a" })
    // committed untouched, optimistic reflects the pending action
    expect(store.getState().committed[0].completed).toBe(false)
    expect(store.getState().optimistic[0].completed).toBe(true)
    store.getState().commit(id)
    expect(store.getState().committed[0].completed).toBe(true)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("discard reverts without committing", () => {
    const a = makeReminder({ id: "a" })
    const store = createRemindersStore([a])
    const id = store.getState().pend({ type: "delete", id: "a" })
    expect(store.getState().optimistic).toEqual([])
    store.getState().discard(id)
    expect(store.getState().committed).toEqual([a])
  })

  it("exposes getReminders without breaking the callable surface", () => {
    const store = createRemindersStore([makeReminder({ id: "a" })])
    expect(typeof store.getReminders).toBe("function")
    expect(typeof store).toBe("function")
    expect(store.getState().committed).toHaveLength(1)
  })
})
