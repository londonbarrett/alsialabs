import { parseISODate, startOfDay } from "@/lib/util/schedule"
import { z } from "zod"

const routineFields = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  cost: z.string().optional().default(""),
  recurrence: z.enum(["daily", "weekly"]).default("weekly"),
  interval: z.coerce.number().int().min(1).max(365).default(1),
  daysOfWeek: z.array(z.string()).optional().default([]),
  time: z.string().optional().default(""),
  startDate: z.string().optional().default(""),
  endDate: z.string().optional().default(""),
  assigneeId: z.string().nullable().optional(),
})

const endAfterStartRefine = (data: z.infer<typeof routineFields>) =>
  !data.startDate || !data.endDate || data.endDate >= data.startDate

const startNotPastRefine = (data: z.infer<typeof routineFields>) =>
  !data.startDate ||
  parseISODate(data.startDate).getTime() >=
    startOfDay(new Date()).getTime()

const endFutureRefine = (data: z.infer<typeof routineFields>) =>
  !data.endDate ||
  parseISODate(data.endDate).getTime() >
    startOfDay(new Date()).getTime()

/** Create validation: the create-only date refines included. */
export const routineSchema = routineFields
  .refine(endAfterStartRefine, {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .refine(startNotPastRefine, {
    message: "Start date cannot be in the past",
    path: ["startDate"],
  })
  .refine(endFutureRefine, {
    message: "End date must be in the future",
    path: ["endDate"],
  })

/** Edit validation: only the ordering refine — editing a routine whose
 * start date has already passed must stay possible. */
const routineUpdateFields = routineFields.refine(endAfterStartRefine, {
  message: "End date must be after start date",
  path: ["endDate"],
})

export const createRoutineSchema = routineSchema.extend({
  projectId: z.uuid(),
})

export const updateRoutineSchema = routineUpdateFields.extend({
  projectId: z.uuid(),
  routineId: z.uuid(),
})

export const deleteRoutineSchema = z.object({
  projectId: z.uuid(),
  routineId: z.uuid(),
})

export const spawnRoutineTaskSchema = z.object({
  routineId: z.uuid(),
  after: z.coerce.date().nullable().optional(),
})

export type RoutineFormData = z.infer<typeof routineSchema>
