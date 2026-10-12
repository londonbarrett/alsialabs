import { z } from "zod"

export const ActivityTypeSchema = z.enum(["call", "email", "meeting", "note"])

export const ActivityFormSchema = z.object({
  clientId: z.uuid("Invalid client ID"),
  type: ActivityTypeSchema,
  subject: z
    .string()
    .min(1, { message: "Subject is required" })
    .transform((v) => v.trim()),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  activityDate: z.string().refine((v) => {
    const d = new Date(v + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return !isNaN(d.getTime()) && d <= today
  }, "Date cannot be in the future"),
})

export const ClientActivityRecordSchema = z.object({
  id: z.string(),
  store_id: z.string().nullable(),
  clientId: z.string(),
  type: ActivityTypeSchema,
  subject: z.string(),
  description: z.string().nullable(),
  activityDate: z.string(),
  performedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const UpsertActivityResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    activity: ClientActivityRecordSchema,
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string()).optional()).optional(),
  }),
])

export type ActivityFormDTO = z.infer<typeof ActivityFormSchema>
export type ActivityTypeDTO = z.infer<typeof ActivityTypeSchema>
export type ClientActivityRecordDTO = z.infer<typeof ClientActivityRecordSchema>
export type UpsertActivityResultDTO = z.infer<typeof UpsertActivityResultSchema>

export const InactiveClientsDaysSchema = z
  .number()
  .int()
  .positive()
  .max(365)
  .nullable()

export type InactiveClientsDaysDTO = z.infer<typeof InactiveClientsDaysSchema>
