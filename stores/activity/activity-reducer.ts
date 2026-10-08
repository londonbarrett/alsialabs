import type { ClientTimelineEntry } from "@/actions/client-timeline"
import type { Reminder } from "@/actions/reminders"
import type {
  ClientActivity,
  ClientReminder,
} from "@/lib/drizzle/schema"

/** One expanded inactive-client row: its own slice of the client's timeline. */
export interface ClientActivityList {
  entries: ClientTimelineEntry[]
  hasMore: boolean
  loaded: boolean
}

export interface ActivityState {
  /** Every reminder across every client, active and completed. */
  reminders: Reminder[]
  /** Keyed by clientId, and only for rows that have been expanded. */
  activities: Record<string, ClientActivityList>
}

export type ActivityAction =
  | {
      type: "addReminder"
      reminder: Reminder
      /**
       * Set when the reminder was created from an expanded row, whose activity
       * list shows the same client's reminders and would otherwise not show it.
       */
      activityClientId?: string
    }
  | { type: "completeReminder"; id: string }
  | { type: "patchReminder"; id: string; patch: Partial<Reminder> }
  | { type: "deleteReminder"; id: string }
  /**
   * Swaps the temp row for the real one the server saved. Activities have no
   * equivalent: an activity is only ever in one list, and its create commits the
   * full saved row as a `patchClientActivity`, whose spread overwrites the temp
   * id with the server id. A reminder needs this action because it can also sit
   * in an expanded row's list (two places to swap) and uses a narrower shape,
   * neither of which a plain patch can express.
   */
  | {
      type: "replaceTempReminder"
      tempId: string
      reminder: Reminder
      activityClientId?: string
    }
  | {
      type: "setClientActivity"
      clientId: string
      entries: ClientTimelineEntry[]
      hasMore: boolean
    }
  | {
      type: "addClientActivity"
      clientId: string
      entry: ClientTimelineEntry
    }
  | {
      type: "patchClientActivity"
      clientId: string
      kind: "activity" | "reminder"
      id: string
      patch: Partial<ClientActivity> | Partial<ClientReminder>
    }
  | { type: "deleteClientActivity"; clientId: string; id: string }

/**
 * Shared so the read path can return a referentially stable value for rows that
 * have never been expanded — a fresh object per call would loop
 * `useSyncExternalStore`. Never mutated; the reducer always replaces the map it holds.
 */
export const EMPTY_ACTIVITIES: ClientActivityList = {
  entries: [],
  hasMore: false,
  loaded: false,
}

function emptyClientActivities(): ClientActivityList {
  return { entries: [], hasMore: false, loaded: false }
}

function patchClientActivities(
  state: ActivityState,
  clientId: string,
  patch: (activities: ClientActivityList) => ClientActivityList
): ActivityState {
  const activities =
    state.activities[clientId] ?? emptyClientActivities()
  return {
    ...state,
    activities: { ...state.activities, [clientId]: patch(activities) },
  }
}

/**
 * Applies a change to every client's activity list, for the reminder actions a
 * card row dispatches: the card cannot know which expanded row is also showing
 * that reminder, and a reminder id is unique, so sweeping is correct without
 * the caller naming a row. Returning `null` drops the entry.
 */
function patchAllClientActivities(
  state: ActivityState,
  patch: (entry: ClientTimelineEntry) => ClientTimelineEntry | null
): ActivityState {
  return {
    ...state,
    activities: Object.fromEntries(
      Object.entries(state.activities).map(([clientId, activities]) => [
        clientId,
        {
          ...activities,
          entries: activities.entries
            .map(patch)
            .filter((e): e is ClientTimelineEntry => e !== null),
        },
      ])
    ),
  }
}

/**
 * The reminders list carries `clientName` for its own row label; an entry in a
 * client activity list is a `ClientReminder`, which does not. The audit fields the list view does not
 * carry are synthesized so the shared row component can render either shape.
 */
function toClientActivityReminder(
  reminder: Reminder
): ClientTimelineEntry {
  const now = new Date()
  return {
    kind: "reminder",
    id: reminder.id,
    clientId: reminder.clientId,
    description: reminder.description,
    remindAt: reminder.remindAt,
    completed: reminder.completed,
    completedAt: null,
    createdBy: "",
    createdAt: now,
    updatedAt: now,
    store_id: null,
  }
}

/**
 * Pure reducer — the store applies it to derive optimistic state.
 *
 * The reminders list completes by marking the row done rather than removing it.
 * Entries in a client activity list are the narrower `ClientTimelineEntry` shape
 * (activities and reminders only, no invoices or payments) that the activity
 * page shows inline for a single client.
 */
export function activityReducer(
  state: ActivityState,
  action: ActivityAction
): ActivityState {
  switch (action.type) {
    case "addReminder": {
      const next = {
        ...state,
        reminders: [action.reminder, ...state.reminders],
      }
      return action.activityClientId
        ? patchClientActivities(
            next,
            action.activityClientId,
            (activities) => ({
              ...activities,
              entries: [
                toClientActivityReminder(action.reminder),
                ...activities.entries,
              ],
            })
          )
        : next
    }
    case "replaceTempReminder": {
      const next = {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === action.tempId ? action.reminder : r
        ),
      }
      return action.activityClientId
        ? patchClientActivities(
            next,
            action.activityClientId,
            (activities) => ({
              ...activities,
              entries: activities.entries.map((e) =>
                e.id === action.tempId
                  ? toClientActivityReminder(action.reminder)
                  : e
              ),
            })
          )
        : next
    }
    case "completeReminder": {
      const next = {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === action.id ? { ...r, completed: true } : r
        ),
      }
      return patchAllClientActivities(next, (e) =>
        e.kind === "reminder" && e.id === action.id
          ? { ...e, completed: true }
          : e
      )
    }
    case "patchReminder": {
      const next = {
        ...state,
        reminders: state.reminders.map((r) =>
          r.id === action.id ? { ...r, ...action.patch } : r
        ),
      }
      return patchAllClientActivities(next, (e) =>
        e.kind === "reminder" && e.id === action.id
          ? { ...e, ...(action.patch as Partial<ClientReminder>) }
          : e
      )
    }
    case "deleteReminder": {
      const next = {
        ...state,
        reminders: state.reminders.filter((r) => r.id !== action.id),
      }
      return patchAllClientActivities(next, (e) =>
        e.id === action.id ? null : e
      )
    }
    case "setClientActivity":
      return patchClientActivities(state, action.clientId, () => ({
        entries: action.entries,
        hasMore: action.hasMore,
        loaded: true,
      }))
    case "addClientActivity":
      return patchClientActivities(
        state,
        action.clientId,
        (activities) => ({
          ...activities,
          entries: [action.entry, ...activities.entries],
        })
      )
    case "patchClientActivity":
      return patchClientActivities(
        state,
        action.clientId,
        (activities) => ({
          ...activities,
          entries: activities.entries.map((e): ClientTimelineEntry => {
            if (e.id !== action.id) return e
            // `kind` discriminates the union, so each branch spreads onto a row
            // of the matching shape.
            if (e.kind === "activity" && action.kind === "activity") {
              return {
                ...e,
                ...(action.patch as Partial<ClientActivity>),
              }
            }
            if (e.kind === "reminder" && action.kind === "reminder") {
              return {
                ...e,
                ...(action.patch as Partial<ClientReminder>),
              }
            }
            return e
          }),
        })
      )
    case "deleteClientActivity":
      return patchClientActivities(
        state,
        action.clientId,
        (activities) => ({
          ...activities,
          entries: activities.entries.filter((e) => e.id !== action.id),
        })
      )
  }
}
