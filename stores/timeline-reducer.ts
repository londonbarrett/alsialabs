import type {
  ClientActivity,
  ClientReminder,
  Invoice,
  InvoicePayment,
} from "@/lib/drizzle/schema"

export type TimelineEntry =
  | ({ kind: "activity" } & ClientActivity)
  | ({ kind: "reminder" } & ClientReminder)
  | ({ kind: "invoice" } & Invoice)
  | ({ kind: "payment" } & InvoicePayment & { invoiceNumber: string })

type TimelineEntryPatch =
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
  | { type: "delete"; id: string }

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
 * Pure reducer — the store applies it to derive optimistic state.
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
    case "delete":
      return state.filter((entry) => entry.id !== action.id)
  }
}
