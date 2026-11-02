import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/drizzle/schema"
import { z } from "zod"

export const CalendarAssignmentSchema = z.object({
  assignmentId: z.string(),
  taskId: z.string(),
  taskName: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  // View columns come back as raw driver strings; coerce them to Dates.
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  projectColor: z.string(),
  projectOwnerName: z.string().nullable(),
  userName: z.string().nullable(),
  userImage: z.string().nullable(),
  comment: z.string().nullable(),
  commentCount: z.number(),
  recurrence: z.enum(["daily", "weekly"]).nullable(),
})

export type CalendarAssignmentDTO = z.infer<
  typeof CalendarAssignmentSchema
>
