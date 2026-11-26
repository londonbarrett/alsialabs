import type { TaskStatus } from "@/lib/drizzle/schema"

/** The canonical closed set: an assignment costs money only in these statuses. */
export const CLOSED_TASK_STATUSES: readonly TaskStatus[] = [
  "done",
  "cancelled",
]
