import type { Reminder } from "@/lib/actions/reminders"
import { createOptimisticStore } from "@/lib/optimistic-store"

export type ReminderAction =
  | { type: "complete"; id: string }
  | { type: "patch"; id: string; patch: Partial<Reminder> }
  | { type: "remove"; id: string }
  | { type: "reset"; reminders: Reminder[] }

/**
 * Pure reducer — module-stable so consumers can use it with
 * useOptimisticDerived. Holds ALL reminders (active + completed);
 * completing marks the reminder done instead of removing it.
 */
export function remindersReducer(
  state: Reminder[],
  action: ReminderAction
): Reminder[] {
  switch (action.type) {
    case "complete":
      return state.map((r) =>
        r.id === action.id ? { ...r, completed: true } : r
      )
    case "patch":
      return state.map((r) =>
        r.id === action.id ? { ...r, ...action.patch } : r
      )
    case "remove":
      return state.filter((r) => r.id !== action.id)
    case "reset":
      return action.reminders
  }
}

/** Unkeyed apply function for the optimistic store. */
export function applyRemindersAction(
  state: Reminder[],
  _key: string | undefined,
  action: ReminderAction
): Reminder[] {
  return remindersReducer(state, action)
}

const initialState: Reminder[] = []

export const useRemindersStore = createOptimisticStore(
  initialState,
  applyRemindersAction
)

/**
 * Hydrate from server props, guarded against referential churn (skips when
 * id lists already match and no optimistic action is in-flight).
 */
export function hydrateReminders(reminders: Reminder[]): void {
  const state = useRemindersStore.getState()
  if (
    state.committed.length === reminders.length &&
    state.committed.every((v, i) => v.id === reminders[i]?.id)
  ) {
    return
  }
  state.hydrate(reminders)
}
