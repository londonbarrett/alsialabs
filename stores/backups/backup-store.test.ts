import type { BackupEntry } from "@/actions/legacy/schemas/backup"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { backupReducer } from "./backup-reducer"
import { createBackupsStore, useBackupsStore } from "./backup-store"

function makeBackup(overrides: Partial<BackupEntry> = {}): BackupEntry {
  return {
    filename: "backup-2024-01-15.sql",
    createdAt: "2024-01-15T00:00:00.000Z",
    sizeBytes: 1024,
    tables: ["clients"],
    ...overrides,
  }
}

describe("backupReducer", () => {
  const a = makeBackup({ filename: "a.sql" })
  const b = makeBackup({ filename: "b.sql" })

  it("add prepends the backup", () => {
    const next = backupReducer(
      { backups: [a] },
      { type: "add", backup: b }
    )
    expect(next.backups).toEqual([b, a])
  })

  it("replaceTemp swaps the temp row for the server entry", () => {
    const temp = makeBackup({ filename: "temp-1.sql" })
    const real = makeBackup({ filename: "real.sql" })
    const next = backupReducer(
      { backups: [temp, a] },
      { type: "replaceTemp", tempId: "temp-1.sql", backup: real }
    )
    expect(next.backups).toEqual([real, a])
  })

  it("restore leaves the list unchanged", () => {
    const next = backupReducer({ backups: [a, b] }, { type: "restore" })
    expect(next).toEqual({ backups: [a, b] })
  })
})

describe("createBackupsStore", () => {
  it("seeds committed and optimistic from server props", () => {
    const a = makeBackup()
    const seed = { backups: [a] }
    const store = createBackupsStore(seed)
    expect(store.getState().committed).toEqual(seed)
    expect(store.getState().optimistic).toEqual(seed)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("shows the temp entry optimistically before the server responds", () => {
    const a = makeBackup()
    const temp = makeBackup({ filename: "temp-1.sql" })
    const store = createBackupsStore({ backups: [a] })
    const id = store.getState().pend({ type: "add", backup: temp })
    expect(store.getState().committed.backups).toEqual([a])
    expect(store.getState().optimistic.backups[0].filename).toBe(
      "temp-1.sql"
    )
    store.getState().discard(id)
    expect(store.getState().optimistic.backups).toEqual([a])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit with replaceTemp swaps the temp row for the server entry", () => {
    const a = makeBackup()
    const temp = makeBackup({ filename: "temp-1.sql" })
    const real = makeBackup({ filename: "real.sql" })
    const store = createBackupsStore({ backups: [a] })
    const id = store.getState().pend({ type: "add", backup: temp })
    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1.sql",
      backup: real,
    })
    expect(store.getState().committed.backups).toEqual([real, a])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("createBackupsStore reseedFromServer replaces the whole state", () => {
    const a = makeBackup({ filename: "a.sql" })
    const b = makeBackup({ filename: "b.sql" })
    const store = createBackupsStore({ backups: [a] })
    store.getState().reseedFromServer({ backups: [b] })
    expect(store.getState().optimistic.backups).toEqual([b])
    expect(store.getState().committed.backups).toEqual([b])
  })
})

describe("useBackupsStore", () => {
  it("useBackupsStore outside its provider throws a provider-named error", () => {
    function Probe() {
      useBackupsStore()
      return null
    }
    expect(() => renderToString(createElement(Probe))).toThrow(
      "useBackupsStore must be used within a BackupsProvider"
    )
  })
})
