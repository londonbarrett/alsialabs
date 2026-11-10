import type { BackupEntry } from "@/actions/legacy/schemas/backup"

export type BackupStoreState = {
  backups: BackupEntry[]
}

export type BackupAction =
  | { type: "add"; backup: BackupEntry }
  | {
      type: "replaceTemp"
      tempId: string
      backup: BackupEntry
    }
  | { type: "restore" }

export function backupReducer(
  state: BackupStoreState,
  action: BackupAction
): BackupStoreState {
  switch (action.type) {
    case "add":
      return { ...state, backups: [action.backup, ...state.backups] }
    case "replaceTemp":
      return {
        ...state,
        backups: state.backups.map((b) =>
          b.filename === action.tempId ? action.backup : b
        ),
      }
    case "restore":
      return state
  }
}
