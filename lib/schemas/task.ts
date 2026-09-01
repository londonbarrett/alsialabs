import { z } from "zod"

export const ALL_TASK_STATUSES = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const

export const COLLABORATOR_TASK_STATUSES = [
  "in_progress",
  "blocked",
  "in_review",
] as const

export type TaskStatus = (typeof ALL_TASK_STATUSES)[number]
export type CollaboratorTaskStatus =
  (typeof COLLABORATOR_TASK_STATUSES)[number]

export const taskSchema = z.object({
  name: z
    .string()
    .min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  cost: z.string().optional().default(""),
  status: z.enum(ALL_TASK_STATUSES).optional().default("todo"),
  priority: z.enum(["urgent", "high"]).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})

export const createTaskSchema = taskSchema.extend({
  projectId: z.uuid(),
})

export const updateTaskSchema = taskSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
})

export const ownerStatusSchema = z.enum(ALL_TASK_STATUSES)

export const collaboratorStatusSchema = z.enum(
  COLLABORATOR_TASK_STATUSES
)

export const taskPrioritySchema = z.enum(["urgent", "high"]).nullable()

export type TaskPriority = z.infer<typeof taskPrioritySchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
