import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"
import { createOptimisticStore } from "@/lib/optimistic-store"
import type { Reminder } from "@/lib/actions/reminders"

export type TimelineEntry =
  | ({ kind: "activity" } & ClientActivity)
  | ({ kind: "reminder" } & ClientReminder)
  | ({ kind: "invoice" } & Invoice)
  | ({ kind: "payment" } & InvoicePayment & { invoiceNumber: string })

export type ReminderDialogTarget = ClientReminder | Reminder

export type TimelineEntryPatch =
  | { kind: "activity"; id: string; patch: Partial<ClientActivity> }
  | { kind: "reminder"; id: string; patch: Partial<ClientReminder> }
  | { kind: "invoice"; id: string; patch: Partial<Invoice> }
  | {
      kind: "payment"
      id: string
      patch: Partial<InvoicePayment & { invoiceNumber: string }>
    }

export type TimelineEntryAction =
  | { type: "add"; entry: TimelineEntry }
  | ({ type: "patch" } & TimelineEntryPatch)
  | { type: "remove"; kind: TimelineEntry["kind"]; id: string }

function getEntryDate(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "activity":
      return entry.activityDate
    case "reminder":
      return entry.remindAt
    case "invoice":
      return entry.issueDate
    case "payment":
      return entry.paymentDate
  }
}

export function sortTimelineEntries(
  entries: TimelineEntry[]
): TimelineEntry[] {
  return [...entries].sort((a, b) => {
    const dateA = new Date(getEntryDate(a)).getTime()
    const dateB = new Date(getEntryDate(b)).getTime()
    if (dateB !== dateA) return dateB - dateA
    const createdA = new Date(a.createdAt).getTime()
    const createdB = new Date(b.createdAt).getTime()
    if (createdB !== createdA) return createdB - createdA
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * Pure reducer — applied to a single client's timeline entries.
 * Exported and module-stable so consumers can use it with
 * useOptimisticDerived.
 */
export function timelineReducer(
  state: TimelineEntry[],
  action: TimelineEntryAction
): TimelineEntry[] {
  switch (action.type) {
    case "add":
      return sortTimelineEntries([action.entry, ...state])
    case "patch":
      return sortTimelineEntries(
        state.map((entry) =>
          entry.kind === action.kind && entry.id === action.id
            ? ({ ...entry, ...action.patch } as TimelineEntry)
            : entry
        )
      )
    case "remove":
      return state.filter(
        (entry) => entry.kind !== action.kind || entry.id !== action.id
      )
  }
}

/**
 * Keyed apply function for the optimistic store — `key` is the clientId.
 */
export function applyTimelineAction(
  byClient: Record<string, TimelineEntry[]>,
  key: string | undefined,
  action: TimelineEntryAction
): Record<string, TimelineEntry[]> {
  if (!key) return byClient
  const current = byClient[key] ?? []
  return { ...byClient, [key]: timelineReducer(current, action) }
}

const initialState: Record<string, TimelineEntry[]> = {}

export const useTimelineStore = createOptimisticStore(
  initialState,
  applyTimelineAction
)

/**
 * Merge server-side entries for a client into the committed store.
 * Guarded against churn: skips when ids + kinds already match.
 */
export function hydrateTimelineEntries(
  clientId: string,
  entries: TimelineEntry[]
): void {
  const sorted = sortTimelineEntries(entries)
  const state = useTimelineStore.getState()
  const current = state.committed[clientId]
  if (
    current &&
    current.length === sorted.length &&
    current.every(
      (v, i) => v.id === sorted[i]?.id && v.kind === sorted[i]?.kind
    )
  ) {
    return
  }
  state.hydrate({ ...state.committed, [clientId]: sorted })
}
