import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/drizzle/schema"
import { z } from "zod"

export const CalendarAssignmentSchema = z.object({
  assignmentId: z.string(),
  taskId: z.string(),
  taskName: z.string(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
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
