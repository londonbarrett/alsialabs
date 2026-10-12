import { z } from "zod"
import { RoutineWithAssigneeSchema } from "./routine"
import { TaskWithCommentCountSchema } from "./task"

export const CalendarTaskDataSchema = TaskWithCommentCountSchema.pick({
  id: true,
  name: true,
  projectId: true,
  description: true,
  cost: true,
  status: true,
  priority: true,
  routineId: true,
  dueDate: true,
  assigneeName: true,
  commentCount: true,
}).extend({
  projectName: z.string(),
  projectColor: z.string(),
  projectOwnerName: z.string().nullable(),
})

export const CalendarRoutineDataSchema = RoutineWithAssigneeSchema.pick({
  id: true,
  name: true,
  projectId: true,
  description: true,
  cost: true,
  recurrence: true,
  interval: true,
  daysOfWeek: true,
  time: true,
  startDate: true,
  endDate: true,
  assigneeName: true,
}).extend({
  projectName: z.string(),
  projectColor: z.string(),
  projectOwnerName: z.string().nullable(),
})

export type CalendarTaskDataDTO = z.infer<typeof CalendarTaskDataSchema>
export type CalendarRoutineDataDTO = z.infer<typeof CalendarRoutineDataSchema>
