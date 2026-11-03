"use client"

import { RestoreDialog } from "@/components/backups/restore-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackupsActions } from "@/stores/backups/use-backups-actions"
import { useBackupsState } from "@/stores/backups/use-backups-state"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

export function BackupsList() {
  const t = useTranslations()
  const { backups } = useBackupsState()
  const { restoreBackup } = useBackupsActions()
  const [restoreTarget, setRestoreTarget] = useState<string | null>(
    null
  )

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setRestoreTarget(null)
  }, [])

  const handleConfirmRestore = useCallback(() => {
    if (restoreTarget === null) return
    void restoreBackup(restoreTarget)
  }, [restoreBackup, restoreTarget])

  if (backups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("backups.empty")}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("backups.date")}</TableHead>
            <TableHead>{t("backups.size")}</TableHead>
            <TableHead>{t("backups.tables")}</TableHead>
            <TableHead className="text-center">
              {t("common.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {backups.map((backup) => (
            <TableRow key={backup.filename}>
              <TableCell>
                <div className="flex flex-col">
                  <span suppressHydrationWarning>
                    {new Date(backup.createdAt).toLocaleString()}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {backup.filename}
                  </span>
                </div>
              </TableCell>
              <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
              <TableCell title={backup.tables?.join(", ") ?? undefined}>
                {backup.tables
                  ? t("backups.tablesCount", {
                      count: backup.tables.length,
                    })
                  : t("backups.tablesUnknown")}
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-3">
                  <a
                    href={`/api/backups/download/${backup.filename}`}
                    className="text-primary underline underline-offset-4 hover:text-foreground"
                  >
                    {t("backups.download")}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRestoreTarget(backup.filename)}
                  >
                    {t("backups.restore")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <RestoreDialog
        filename={restoreTarget ?? ""}
        open={restoreTarget !== null}
        onOpenChange={handleOpenChange}
        onConfirm={handleConfirmRestore}
      />
    </div>
  )
}
