"use client"

import {
  createBackup as createBackupAction,
  restoreBackup as restoreBackupAction,
} from "@/actions/legacy/backups"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useBackupsStore } from "./backup-store"

export function useBackupsActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useBackupsStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeCreate } = useAction(createBackupAction)
  const { executeAsync: executeRestore } = useAction(
    restoreBackupAction
  )

  async function createBackup(tables: string[]): Promise<void> {
    const temp = {
      filename: `temp-${Date.now()}.sql`,
      createdAt: new Date().toISOString(),
      sizeBytes: 0,
      tables,
    }
    const result = await run(
      { type: "add", backup: temp },
      () => executeCreate({ tables }),
      {
        commitAction: (r) =>
          r.data
            ? {
                type: "replaceTemp",
                tempId: temp.filename,
                backup: r.data,
              }
            : undefined,
      }
    )
    settle(result, t("backups.created"))
  }

  async function restoreBackup(filename: string): Promise<void> {
    const result = await run({ type: "restore" }, () =>
      executeRestore({ filename })
    )
    settle(result, t("backups.restored"))
  }

  return { createBackup, restoreBackup }
}
