"use client"

import type { BackupEntry } from "@/actions/legacy/schemas/backup"
import { useServerReseed } from "@/hooks/use-server-reseed"
import {
  createBackupsStore,
  BackupsStoreContext,
} from "@/stores/backups/backup-store"
import { useMemo, useState } from "react"

export function BackupsProvider({
  backups,
  children,
}: {
  backups: BackupEntry[]
  children: React.ReactNode
}) {
  // Memoized so client-only re-renders keep the same seed identity;
  // `useServerReseed` compares by identity and would wipe optimistic state.
  const seed = useMemo(() => ({ backups }), [backups])
  const [store] = useState(() => createBackupsStore(seed))
  useServerReseed(store, seed)

  return (
    <BackupsStoreContext value={store}>{children}</BackupsStoreContext>
  )
}
