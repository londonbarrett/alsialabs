"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import { useStore } from "zustand"
import type { BackupAction, BackupStoreState } from "./backup-reducer"
import { useBackupsStore } from "./backup-store"

type StoreType = OptimisticStore<BackupStoreState, BackupAction>

export function useBackupsState() {
  const store = useBackupsStore()
  const backups = useStore(
    store,
    (s: StoreType) => s.optimistic.backups
  )
  const pending = useStore(store, (s: StoreType) => s.pending)

  return { backups, pending }
}
