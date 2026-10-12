import { z } from "zod"

export const ImportClientsResultSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    importedCount: z.number(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
])

export type ImportClientsResultDTO = z.infer<typeof ImportClientsResultSchema>

export const CsvRecordSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(500)
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1)
    .max(100)
    .transform((v) => v.trim()),
  location: z
    .string()
    .max(1000)
    .transform((v) => v.trim())
    .optional()
    .default(""),
  comments: z
    .string()
    .max(5000)
    .transform((v) => v.trim())
    .optional()
    .default(""),
  email: z
    .string()
    .max(500)
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

export type CsvRecordDTO = z.infer<typeof CsvRecordSchema>
