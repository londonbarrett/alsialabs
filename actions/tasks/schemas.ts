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

export const TaskPrioritySchema = z.enum(TASK_PRIORITIES).nullable()

export type TaskPriorityDTO = z.infer<typeof TaskPrioritySchema>

/**
 * Costs are whole or fractional currency units (up to two decimals):
 * `MoneyInput` produces digits with an optional decimal point, and an
 * untouched or cleared field is the empty string. Both the task form and the
 * inline recost payload share this shape.
 */
const CostInputSchema = z
  .string()
  .regex(/^\d*(?:\.\d{0,2})?$/, { message: "INVALID_COST" })
  .optional()
  .default("")

/**
 * Forms submit a wall-clock calendar day, never an ISO instant. Appending `Z`
 * only validates the calendar value; the project zone is applied server-side
 * when the day is combined with its time strings.
 */
const DateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "INVALID_DATE" })
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    )
  }, { message: "INVALID_DATE" })

// ---------- Response schemas ----------

// ---------- Assignment-era task schemas ----------

const TaskFormBaseSchema = z.object({
  name: z
    .string()
    .min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  cost: CostInputSchema,
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  priority: z.enum(TASK_PRIORITIES).nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).optional().default([]),
  startDate: DateKeySchema.nullable().optional(),
  endDate: DateKeySchema.nullable().optional(),
  recurrence: z.enum(["daily", "weekly"]).nullable().optional(),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.string()).optional().default([]),
  startTime: z.string().optional().default(""),
  endTime: z.string().optional().default(""),
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
      // Date keys sort chronologically as strings; no host-local `Date` parse.
      if (value.endDate < value.startDate) {
        ctx.addIssue({
          code: "custom",
          message: "END_BEFORE_START",
          path: ["endDate"],
        })
      }
      if (value.startDate !== value.endDate) {
        ctx.addIssue({
          code: "custom",
          message: "SAME_DAY_REQUIRED",
          path: ["endDate"],
        })
      }
    }
  } else if (
    value.startDate &&
    value.endDate &&
    value.endDate < value.startDate
  ) {
    // The end date is an optional "until" for the schedule, compared at day
    // precision. An all-day repeating task needs no occurrence time.
    ctx.addIssue({
      code: "custom",
      message: "END_BEFORE_START",
      path: ["endDate"],
    })
  }

  // A timed task needs both ends of its window: all-day is the only case that
  // submits empty times, and a lone time cannot be resolved into an instant.
  if (Boolean(value.startTime) !== Boolean(value.endTime)) {
    ctx.addIssue({
      code: "custom",
      message: "END_TIME_REQUIRED",
      path: ["endTime"],
    })
  }
}

export const TaskFormSchema =
  TaskFormBaseSchema.superRefine(refineTaskWindow)

export const CreateTaskSchema = TaskFormBaseSchema.extend({
  projectId: z.uuid(),
}).superRefine(refineTaskWindow)

export const UpdateTaskSchema = TaskFormBaseSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
  unassignAs: z
    .record(z.string().min(1), z.enum(["done", "cancelled"]))
    .optional(),
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
  cost: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  /** Project zone the instants above are displayed in. */
  timeZone: z.string(),
  /** Wall-clock occurrence time; `null` is the authoritative all-day flag. */
  startTime: z.string().nullable(),
})

export const TaskRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  cost: z.string(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  recurrence: z.enum(["daily", "weekly"]).nullable(),
  interval: z.number(),
  daysOfWeek: z.array(z.string()).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  archived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TaskWithAssignmentsSchema = TaskRecordSchema.extend({
  assignments: z.array(TaskAssignmentSchema),
  assigneeIds: z.array(z.string()),
  commentCount: z.number(),
  /**
   * TRUE TOTAL of terminal (`done`+`cancelled`) assignments on the
   * task, counted server-side over `task_assignment` — including rows
   * that live behind Load More on a repeating task. Store rows
   * undercount there (one row per assignee), so the status cell must
   * never derive this from loaded rows.
   */
  closedCount: z.number(),
  /**
   * Server-authoritative sum of the task's CLOSED assignments' costs
   * (`done` and `cancelled` only), with no pagination. Repeating tasks
   * hide history behind Load More, so deriving this from loaded rows would
   * silently undercount; the closed set is part of the SQL sum, never
   * computed in JavaScript. Defaulted so actions that construct a task DTO
   * before the total is threaded through still validate; the query always
   * supplies the real value.
   */
  totalCost: z.number().default(0),
  /**
   * Computed at fetch time from the first open assignment in the project
   * zone; the client only reads it. Defaulted so actions that build a task
   * DTO before a refetch still validate.
   */
  overdue: z.boolean().default(false),
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
  cost: z.string(),
  startDate: z.coerce.date().nullable(),
  endDate: z.coerce.date().nullable(),
  /** Each row formats its own instants in its own project's zone. */
  timeZone: z.string(),
  /** `null` is all-day; never infer it from an instant's hour. */
  startTime: z.string().nullable(),
  recurrence: z.enum(["daily", "weekly"]).nullable(),
  commentCount: z.number(),
  /** Computed server-side in the row's own project zone. */
  overdue: z.boolean().default(false),
})

export const AssignmentStatusResultSchema = z.object({
  assignment: TaskAssignmentSchema,
  nextAssignment: TaskAssignmentSchema.nullable(),
  /** Sum of the costs of every assignment spawned by this status change. */
  spawnedCostTotal: z.number().default(0),
})

export const UpdateAssignmentCostSchema = z.object({
  projectId: z.uuid(),
  assignmentId: z.uuid(),
  cost: CostInputSchema,
})

/**
 * One explicit Save writes both the corrected cost and the manager's
 * performance note. The task id scopes the write to the row the manager saw.
 */
export const UpdateAssignmentSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  assignmentId: z.uuid(),
  cost: CostInputSchema,
  comment: z.string().max(2000),
})

export const ArchiveTaskSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  closeAs: z.enum(["done", "cancelled"]),
})

export const UnarchiveTaskSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
})

export const UnarchiveTaskResultSchema = z.object({
  spawned: z.array(TaskAssignmentSchema),
})

// ---------- Assignment history ----------

export const HISTORY_PAGE_SIZE = 10

export const TaskAssignmentHistorySchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  limit: z.number().int().min(1).max(50),
  offset: z.number().int().min(0),
})

export const TaskAssignmentHistoryResultSchema = z.object({
  assignments: z.array(TaskAssignmentSchema),
  hasMore: z.boolean(),
})

export type TaskFormDTO = z.infer<typeof TaskFormSchema>
export type CreateTaskDTO = z.infer<typeof CreateTaskSchema>
export type UpdateTaskDTO = z.infer<typeof UpdateTaskSchema>

/**
 * Wall-clock form values after the action resolves them to instants in the
 * project zone. Internal to the action → query boundary; never sent to a
 * client.
 */
export type TaskWriteDTO<
  Input extends { startDate?: unknown; endDate?: unknown },
> = Omit<Input, "startDate" | "endDate"> & {
  startDate: Date | null
  endDate: Date | null
}
export type TaskAssignmentDTO = z.infer<typeof TaskAssignmentSchema>
export type TaskAssignmentHistoryDTO = z.infer<
  typeof TaskAssignmentHistoryResultSchema
>
export type TaskRecordDTO = z.infer<typeof TaskRecordSchema>
export type TaskWithAssignmentsDTO = z.infer<
  typeof TaskWithAssignmentsSchema
>
export type MyAssignmentDTO = z.infer<typeof MyAssignmentSchema>
export type AssignmentStatusResultDTO = z.infer<
  typeof AssignmentStatusResultSchema
>
export type UpdateAssignmentDTO = z.infer<typeof UpdateAssignmentSchema>
export type ArchiveTaskDTO = z.infer<typeof ArchiveTaskSchema>
export type UnarchiveTaskDTO = z.infer<typeof UnarchiveTaskSchema>
export type UnarchiveTaskResultDTO = z.infer<
  typeof UnarchiveTaskResultSchema
>

// ---------- Task comment schemas ----------

export const TaskCommentSchema = z.object({
  content: z
    .string()
    .min(1, { message: "COMMENT_REQUIRED" })
    .transform((v) => v.trim()),
})

export const CreateTaskCommentSchema = TaskCommentSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
})

export const UpdateTaskCommentSchema = TaskCommentSchema.extend({
  projectId: z.uuid(),
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export const DeleteTaskCommentSchema = z.object({
  projectId: z.uuid(),
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export type CreateTaskCommentDTO = z.infer<
  typeof CreateTaskCommentSchema
>
export type UpdateTaskCommentDTO = z.infer<
  typeof UpdateTaskCommentSchema
>

export const TaskCommentWithAuthorSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  authorImage: z.string().nullable(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TaskCommentResultSchema = z.object({
  comment: TaskCommentWithAuthorSchema,
})

export const DeleteTaskCommentResultSchema = z.object({
  commentId: z.string(),
})

export type TaskCommentWithAuthorDTO = z.infer<
  typeof TaskCommentWithAuthorSchema
>
export type DeleteTaskCommentResultDTO = z.infer<
  typeof DeleteTaskCommentResultSchema
>
