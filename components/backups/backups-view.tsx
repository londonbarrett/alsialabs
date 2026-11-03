"use client"

import { BackupsList } from "@/components/backups/backups-list"
import { TableSelection } from "@/components/backups/table-selection"
import { Button } from "@/components/ui/button"
import { filterAvailableTableNames } from "@/lib/backup/table-names"
import { useBackupsActions } from "@/stores/backups/use-backups-actions"
import { useBackupsState } from "@/stores/backups/use-backups-state"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

const TABLES_STORAGE_KEY = "alsia.backup.tables"

function parseStoredTables(): string[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(TABLES_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (!parsed.every((item) => typeof item === "string")) return null
    return parsed as string[]
  } catch {
    return null
  }
}

export function BackupsView({ tables }: { tables: string[] }) {
  const t = useTranslations()
  const { pending } = useBackupsState()
  const { createBackup } = useBackupsActions()
  const [selected, setSelected] = useState<string[]>(tables)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function hydrateSelection() {
      const stored = filterAvailableTableNames(
        parseStoredTables(),
        tables
      )
      if (stored !== null) setSelected(stored)
    }
    hydrateSelection()
  }, [tables])

  const handleCreate = useCallback(async () => {
    window.localStorage.setItem(
      TABLES_STORAGE_KEY,
      JSON.stringify(selected)
    )
    setSubmitting(true)
    try {
      await createBackup(selected)
    } finally {
      setSubmitting(false)
    }
  }, [createBackup, selected])

  const creating = pending.length > 0 || submitting

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("backups.title")}
        </h1>
        <Button
          onClick={handleCreate}
          disabled={creating || selected.length === 0}
        >
          {creating ? t("backups.creating") : t("backups.create")}
        </Button>
      </div>
      <TableSelection
        tables={tables}
        selected={selected}
        onChange={setSelected}
      />
      <BackupsList />
    </div>
  )
}
