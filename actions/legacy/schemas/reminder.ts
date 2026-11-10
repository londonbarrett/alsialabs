import { z } from "zod"

export const ReminderRecordSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  clientName: z.string(),
  description: z.string(),
  remindAt: z.string(),
  completed: z.boolean(),
})

export const ReminderFormSchema = z.object({
  clientId: z.uuid({ message: "Invalid client ID" }),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .transform((v) => v.trim()),
  remindAt: z.string().refine((v) => {
    const d = new Date(v + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return !isNaN(d.getTime()) && d >= today
  }, "Date must be today or in the future"),
})

export type ReminderRecordDTO = z.infer<typeof ReminderRecordSchema>
export type ReminderFormDTO = z.infer<typeof ReminderFormSchema>
