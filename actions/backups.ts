"use server"

import { z } from "zod"

import {
  BackupEntrySchema,
  CreateBackupSchema,
  RestoreBackupSchema,
} from "@/actions/schemas/backup"
import { throwActionError } from "@/lib/action-result"
import { pgDump, restoreSql } from "@/lib/backup/exec"
import {
  resolveBackupSqlPath,
  writeBackupFile,
} from "@/lib/backup/files"
import {
  listDependentViews,
  listPublicTables,
  validateTableSelection,
} from "@/lib/backup/tables"
import { adminAction } from "@/lib/safe-action"

export const createBackup = adminAction
  .metadata({})
  .inputSchema(CreateBackupSchema)
  .outputSchema(BackupEntrySchema)
  .action(async ({ parsedInput }) => {
    const dbDirectUrl = process.env.DB_DIRECT_URL
    if (!dbDirectUrl) {
      throwActionError("INTERNAL_SERVER_ERROR")
    }
    const available = await listPublicTables()
    validateTableSelection(parsedInput.tables, available)
    const views = await listDependentViews(parsedInput.tables)
    const dumped = [...parsedInput.tables, ...views]
    const dump = await pgDump(dumped, dbDirectUrl)
    if (!dump.ok) {
      console.error("[backup] pg_dump failed:", dump.stderr)
      throwActionError("BACKUP_FAILED")
    }
    return writeBackupFile(dump.stdout, dumped)
  })

export const restoreBackup = adminAction
  .metadata({})
  .inputSchema(RestoreBackupSchema)
  .outputSchema(z.object({ filename: z.string() }))
  .action(async ({ parsedInput }) => {
    const file = resolveBackupSqlPath(parsedInput.filename)
    const dbDirectUrl = process.env.DB_DIRECT_URL
    if (!dbDirectUrl) {
      throwActionError("INTERNAL_SERVER_ERROR")
    }
    const result = await restoreSql(file, dbDirectUrl)
    if (!result.ok) {
      console.error("[backup] psql failed:", result.stderr)
      throwActionError("RESTORE_FAILED")
    }
    return { filename: parsedInput.filename }
  })
