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

export type TimelineEntryAction =
  | { type: "add"; entry: TimelineEntry }
  | {
      type: "patch"
      kind: TimelineEntry["kind"]
      id: string
      patch: Partial<TimelineEntry>
    }
  | { type: "remove"; kind: TimelineEntry["kind"]; id: string }

function getEntryDate(entry: TimelineEntry): string {
  switch (entry.kind) {
    case "activity":
      return (entry as ClientActivity).activityDate
    case "reminder":
      return (entry as ClientReminder).remindAt
    case "invoice":
      return (entry as Invoice).issueDate
    case "payment":
      return (entry as InvoicePayment & { invoiceNumber: string }).paymentDate
  }
}

export function sortTimelineEntries(entries: TimelineEntry[]): TimelineEntry[] {
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
