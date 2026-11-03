import { createOptimisticStore } from "@/lib/optimistic-store"
import { createContext, useContext } from "react"
import { backupReducer, type BackupStoreState } from "./backup-reducer"

export function createBackupsStore(seed: BackupStoreState) {
  return createOptimisticStore({
    initialState: seed,
    reducer: backupReducer,
  })
}

type BackupsStore = ReturnType<typeof createBackupsStore>

export const BackupsStoreContext = createContext<BackupsStore | null>(
  null
)

export function useBackupsStore(): BackupsStore {
  const store = useContext(BackupsStoreContext)
  if (!store) {
    throw new Error(
      "useBackupsStore must be used within a BackupsProvider"
    )
  }
  return store
}
