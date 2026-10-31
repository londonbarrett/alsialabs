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
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  recurrence: z.enum(["daily", "weekly"]).nullable(),
  interval: z.number(),
  daysOfWeek: z.array(z.string()).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  assigneeId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type TaskRecordDTO = z.infer<typeof TaskRecordSchema>

// ---------- Assignment-era task schemas ----------

const TaskFormBaseSchema = z.object({
  name: z
    .string()
    .min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).optional().default([]),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  recurrence: z.enum(["daily", "weekly"]).nullable().optional(),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.string()).optional().default([]),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
  /** Temporary compatibility field; Task 11 removes task costs. */
  cost: z.string().optional().default(""),
})

type TaskFormValue = z.infer<typeof TaskFormBaseSchema>

function refineTaskWindow(
  value: TaskFormValue,
  ctx: z.RefinementCtx
): void {
  if (!value.recurrence) {
    if (!value.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "START_REQUIRED",
        path: ["startDate"],
      })
    }
    if (!value.endDate) {
      ctx.addIssue({
        code: "custom",
        message: "END_REQUIRED",
        path: ["endDate"],
      })
    }
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate)
      const end = new Date(value.endDate)
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
      ) {
        ctx.addIssue({
          code: "custom",
          message: "INVALID_DATE",
          path: ["startDate"],
        })
        return
      }
      if (end.getTime() < start.getTime()) {
        ctx.addIssue({
          code: "custom",
          message: "END_BEFORE_START",
          path: ["endDate"],
        })
      }
      if (start.toDateString() !== end.toDateString()) {
        ctx.addIssue({
          code: "custom",
          message: "SAME_DAY_REQUIRED",
          path: ["endDate"],
        })
      }
    }
    return
  }

  if (!value.startTime) {
    ctx.addIssue({
      code: "custom",
      message: "START_TIME_REQUIRED",
      path: ["startTime"],
    })
  }
}

export const TaskFormSchema = TaskFormBaseSchema.superRefine(
  refineTaskWindow
)

export const CreateTaskV2Schema = TaskFormBaseSchema.extend({
  projectId: z.uuid(),
}).superRefine(refineTaskWindow)

export const UpdateTaskV2Schema = TaskFormBaseSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
}).superRefine(refineTaskWindow)

/**
 * The detail view's date columns are `sql<>`-typed, so drizzle hands them
 * back as the driver's raw timestamp strings instead of Dates: every schema
 * that validates a view row coerces them.
 */
export const TaskAssignmentSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  userImage: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  comment: z.string().nullable(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
})

export const TaskRecordV2Schema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  recurrence: z.enum(["daily", "weekly"]).nullable(),
  interval: z.number(),
  daysOfWeek: z.array(z.string()).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  /** Temporary compatibility field; Task 11 removes task costs. */
  cost: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TaskWithAssignmentsSchema = TaskRecordV2Schema.extend({
  assignments: z.array(TaskAssignmentSchema),
  commentCount: z.number(),
})

export const MyTasksTabSchema = z.enum(["active", "past"])
export type MyTasksTab = z.infer<typeof MyTasksTabSchema>

export const MyAssignmentSchema = z.object({
  assignmentId: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  projectName: z.string(),
  projectColor: z.string(),
  projectOwnerName: z.string().nullable(),
  role: z.enum(["owner", "admin", "collaborator"]),
  status: z.enum(TASK_STATUSES),
  comment: z.string().nullable(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  commentCount: z.number(),
})

export const AssignmentStatusResultSchema = z.object({
  assignment: TaskAssignmentSchema,
  nextAssignment: TaskAssignmentSchema.nullable(),
})

export type TaskFormDTO = z.infer<typeof TaskFormSchema>
export type CreateTaskV2DTO = z.infer<typeof CreateTaskV2Schema>
export type UpdateTaskV2DTO = z.infer<typeof UpdateTaskV2Schema>
export type TaskAssignmentDTO = z.infer<typeof TaskAssignmentSchema>
export type TaskRecordV2DTO = z.infer<typeof TaskRecordV2Schema>
export type TaskWithAssignmentsDTO = z.infer<
  typeof TaskWithAssignmentsSchema
>
export type MyAssignmentDTO = z.infer<typeof MyAssignmentSchema>
export type AssignmentStatusResultDTO = z.infer<
  typeof AssignmentStatusResultSchema
>
