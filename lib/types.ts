/**
 * Client-only contracts.
 *
 * Server response shapes live next to their actions in `actions/schemas/*`;
 * only types that exist purely for client UI state (submit contracts, event
 * metadata, settle results) belong here.
 */

/**
 * The submit contract `RoutineDialog` `components/projects/routines/routine-dialog.tsx`
 * requires. The two-step form hands its fields over as plain strings, so the
 * action hook coerces `recurrence`/`interval` before parsing server-side.
 */
export type RoutineSubmitData = {
  name: string
  description: string
  cost: string
  recurrence: string
  interval: string
  daysOfWeek: string[]
  time: string
  startDate: string
  endDate: string
  assigneeId: string | null
}

/** App-level metadata carried by calendar events. */
export type CalendarEventMeta = {
  kind?: "task" | "routine"
  taskId?: string
  routineId?: string
  projectId?: string
  projectName?: string
  projectOwnerName?: string | null
  status?: string
  priority?: string | null
  assigneeName?: string | null
  dueDateIso?: string | null
  description?: string | null
  cost?: string | null
  commentCount?: number
  recurrence?: string
  interval?: number
  daysOfWeek?: string[]
  time?: string | null
  startDate?: string | null
  endDate?: string | null
}

/**
 * The submit contract `ReminderDialog` `components/clients/reminder-dialog.tsx`
 * requires. Shared by the timeline and reminders submit handlers, which differ
 * only in the store they write to.
 */
export type ReminderSubmitData = {
  clientId: string
  description: string
  remindAt: string
  /**
   * Only the reminders list needs it — that row renders the client name, so a
   * temp row has to carry one. The timeline derives the client from the page it
   * is on and has no name to hand over.
   */
  clientName?: string
}

/**
 * The contract a mutation handler hands back to a form/dialog: success plus an
 * optional translated error and server field errors. A handler returns this
 * only when its caller consumes the outcome; otherwise it returns `void`. The
 * invoice and reminder hooks return it (`InvoiceForm` renders `fieldErrors`,
 * `ReminderDialog` toasts `success`/`error`); everything else is
 * fire-and-forget. Produced by `useSettle` `hooks/use-settle.ts`.
 */
export type SettleResult = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}
