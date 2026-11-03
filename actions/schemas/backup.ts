import { z } from "zod"

export const BackupEntrySchema = z.object({
  filename: z.string(),
  createdAt: z.string(),
  sizeBytes: z.number(),
  tables: z.array(z.string()).nullable(),
})

export const CreateBackupSchema = z.object({
  tables: z.string().min(1).array().min(1),
})

export const RestoreBackupSchema = z.object({
  filename: z.string().min(1),
})

export type BackupEntry = z.infer<typeof BackupEntrySchema>
