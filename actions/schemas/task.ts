import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/drizzle/schema"
import { z } from "zod"

export const ALL_TASK_STATUSES = TASK_STATUSES

export const COLLABORATOR_TASK_STATUSES = [
  "in_progress",
  "blocked",
  "in_review",
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type CollaboratorTaskStatus =
  (typeof COLLABORATOR_TASK_STATUSES)[number]

export const TaskSchema = z.object({
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
  status: z.enum(TASK_STATUSES).optional().default("todo"),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
})

export const CreateTaskSchema = TaskSchema.extend({
  projectId: z.uuid(),
})

export const UpdateTaskSchema = TaskSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
})

export const OwnerStatusSchema = z.enum(ALL_TASK_STATUSES)

export const CollaboratorStatusSchema = z.enum(
  COLLABORATOR_TASK_STATUSES
)

export const TaskPrioritySchema = z.enum(TASK_PRIORITIES).nullable()

export type TaskPriorityDTO = z.infer<typeof TaskPrioritySchema>
export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>

// ---------- Response schemas ----------

export const TaskRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  cost: z.string().nullable(),
  status: z.enum(ALL_TASK_STATUSES),
  priority: z.enum(["urgent", "high"]).nullable(),
  routineId: z.string().nullable(),
  dueDate: z.date().nullable(),
  assigneeId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TaskWithCommentCountSchema = TaskRecordSchema.extend({
  assigneeName: z.string().nullable(),
  commentCount: z.number(),
})

export const MyTaskSchema = TaskWithCommentCountSchema.extend({
  projectName: z.string(),
  projectColor: z.string(),
  projectOwnerName: z.string().nullable(),
  isOwner: z.boolean(),
})

export const TaskStatusResultSchema = z.object({
  nextTask: TaskRecordSchema.optional(),
})

export type TaskRecordDTO = z.infer<typeof TaskRecordSchema>
export type TaskWithCommentCountDTO = z.infer<
  typeof TaskWithCommentCountSchema
>
export type MyTaskDTO = z.infer<typeof MyTaskSchema>
export type TaskStatusResultDTO = z.infer<typeof TaskStatusResultSchema>
