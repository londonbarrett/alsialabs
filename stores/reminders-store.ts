import type { Reminder } from "@/lib/actions/reminders"
import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"

export type ReminderAction =
  | { type: "add"; reminder: Reminder }
  | { type: "complete"; id: string }
  | { type: "patch"; id: string; patch: Partial<Reminder> }
  | { type: "delete"; id: string }
  /** Swaps the temp row for the real one the server saved. */
  | { type: "replaceTemp"; tempId: string; reminder: Reminder }

/**
 * Pure reducer — the store applies it to derive optimistic state. Holds ALL
 * reminders (active + completed); completing marks the reminder done instead
 * of removing it.
 */
export function remindersReducer(
  state: Reminder[],
  action: ReminderAction
): Reminder[] {
  switch (action.type) {
    case "add":
      return [action.reminder, ...state]
    case "replaceTemp":
      return state.map((r) =>
        r.id === action.tempId ? action.reminder : r
      )
    case "complete":
      return state.map((r) =>
        r.id === action.id ? { ...r, completed: true } : r
      )
    case "patch":
      return state.map((r) =>
        r.id === action.id ? { ...r, ...action.patch } : r
      )
    case "delete":
      return state.filter((r) => r.id !== action.id)
  }
}

export function createRemindersStore(reminders: Reminder[]) {
  const store = createOptimisticStore(reminders, remindersReducer)
  return Object.assign(store, {
    getReminders: () => store((s) => s.optimistic),
  })
}

type RemindersStore = ReturnType<typeof createRemindersStore>

export const RemindersStoreContext =
  createContext<RemindersStore | null>(null)

export function useRemindersStore(): RemindersStore {
  const store = useContext(RemindersStoreContext)
  if (!store) {
    throw new Error(
      "useRemindersStore must be used within a RemindersProvider"
    )
  }
  return store
}
