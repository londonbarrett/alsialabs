import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fsControl = vi.hoisted(() => ({
  eexistOnNextSqlCreate: false,
  enoentStatOn: null as string | null,
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("node:fs/promises")>()
  const realWriteFile = actual.writeFile
  const realStat = actual.stat
  return {
    ...actual,
    stat: vi.fn(
      (
        file: import("node:fs").PathLike
      ): Promise<import("node:fs").Stats> => {
        if (
          fsControl.enoentStatOn !== null &&
          file === fsControl.enoentStatOn
        ) {
          const error = new Error(
            "ENOENT: no such file or directory, stat"
          ) as NodeJS.ErrnoException
          error.code = "ENOENT"
          return Promise.reject(error)
        }
        return realStat(file)
      }
    ),
    writeFile: vi.fn(
      (
        file: Parameters<typeof realWriteFile>[0],
        data: Parameters<typeof realWriteFile>[1],
        options?: Parameters<typeof realWriteFile>[2]
      ) => {
        if (
          fsControl.eexistOnNextSqlCreate &&
          typeof file === "string" &&
          file.endsWith(".sql")
        ) {
          fsControl.eexistOnNextSqlCreate = false
          const error = new Error(
            "EEXIST: file already exists, open"
          ) as NodeJS.ErrnoException
          error.code = "EEXIST"
          return Promise.reject(error)
        }
        return realWriteFile(file, data, options)
      }
    ),
  }
})

import { ActionError } from "@/lib/action-result"

import {
  backupDir,
  listBackups,
  resolveBackupSqlPath,
  writeBackupFile,
} from "./files"

const writeFileMock = vi.mocked(writeFile)

describe("lib/backup/files", () => {
  let dir: string
  let previousBackupDir: string | undefined

  beforeEach(async () => {
    fsControl.eexistOnNextSqlCreate = false
    fsControl.enoentStatOn = null
    previousBackupDir = process.env.BACKUP_DIR
    dir = await mkdtemp(path.join(tmpdir(), "alsia-backup-"))
    process.env.BACKUP_DIR = dir
  })

  afterEach(async () => {
    if (previousBackupDir === undefined) {
      delete process.env.BACKUP_DIR
    } else {
      process.env.BACKUP_DIR = previousBackupDir
    }
    await rm(dir, { recursive: true, force: true })
  })

  it("backupDir reads BACKUP_DIR at call time and defaults to <cwd>/backups", () => {
    expect(backupDir()).toBe(path.resolve(dir))
    process.env.BACKUP_DIR = path.join(dir, "nested")
    expect(backupDir()).toBe(path.resolve(dir, "nested"))
    delete process.env.BACKUP_DIR
    expect(backupDir()).toBe(path.resolve(process.cwd(), "backups"))
  })

  it("writeBackupFile writes .sql + .meta.json and returns the entry", async () => {
    const now = new Date(2026, 10, 2, 14, 30)
    const entry = await writeBackupFile(
      "-- dump",
      ["role", "user"],
      now
    )

    expect(entry.filename).toBe("2026-11-02_14-30-00.sql")
    expect(entry.tables).toEqual(["role", "user"])
    expect(entry.sizeBytes).toBe("-- dump".length)
    expect(entry.createdAt).toBe(now.toISOString())

    const sql = await readFile(path.join(dir, entry.filename), "utf8")
    expect(sql).toBe("-- dump")

    const sidecar = JSON.parse(
      await readFile(
        path.join(dir, "2026-11-02_14-30-00.meta.json"),
        "utf8"
      )
    ) as { createdAt: string; tables: string[] }
    expect(sidecar.createdAt).toBe(now.toISOString())
    expect(sidecar.tables).toEqual(["role", "user"])
  })

  it("writeBackupFile reports size in bytes", async () => {
    const entry = await writeBackupFile(
      "héllo",
      ["t"],
      new Date(2026, 10, 2, 14, 30)
    )

    expect(entry.sizeBytes).toBe(6)
  })

  it("appends -1, -2 on same-second collisions", async () => {
    const d = new Date(2026, 10, 2, 14, 30)
    const a = await writeBackupFile("1", ["t"], d)
    const b = await writeBackupFile("2", ["t"], d)
    const c = await writeBackupFile("3", ["t"], d)

    expect(a.filename).toBe("2026-11-02_14-30-00.sql")
    expect(b.filename).toBe("2026-11-02_14-30-00-1.sql")
    expect(c.filename).toBe("2026-11-02_14-30-00-2.sql")
  })

  it("skips a timestamp when only its sidecar exists", async () => {
    const d = new Date(2026, 10, 2, 14, 30)
    await writeFile(
      path.join(dir, "2026-11-02_14-30-00.meta.json"),
      "{}"
    )

    const entry = await writeBackupFile("1", ["t"], d)

    expect(entry.filename).toBe("2026-11-02_14-30-00-1.sql")
  })

  it("retries with -1 when the exclusive .sql create hits EEXIST", async () => {
    const d = new Date(2026, 10, 2, 14, 30)
    fsControl.eexistOnNextSqlCreate = true

    const entry = await writeBackupFile("-- dump", ["t"], d)

    expect(fsControl.eexistOnNextSqlCreate).toBe(false)
    expect(entry.filename).toBe("2026-11-02_14-30-00-1.sql")

    const sql = await readFile(path.join(dir, entry.filename), "utf8")
    expect(sql).toBe("-- dump")

    const sidecar = JSON.parse(
      await readFile(
        path.join(dir, "2026-11-02_14-30-00-1.meta.json"),
        "utf8"
      )
    ) as { createdAt: string; tables: string[] }
    expect(sidecar).toEqual({
      createdAt: d.toISOString(),
      tables: ["t"],
    })

    await expect(
      readFile(path.join(dir, "2026-11-02_14-30-00.sql"))
    ).rejects.toThrow()
    await expect(
      readFile(path.join(dir, "2026-11-02_14-30-00.meta.json"))
    ).rejects.toThrow()

    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(dir, "2026-11-02_14-30-00-1.sql"),
      "-- dump",
      { flag: "wx", encoding: "utf8" }
    )
  })

  it("listBackups returns newest first and tolerates a missing sidecar", async () => {
    const older = await writeBackupFile(
      "a",
      ["t"],
      new Date(2026, 0, 1, 10, 0)
    )
    const newer = await writeBackupFile(
      "b",
      ["t"],
      new Date(2026, 0, 2, 10, 0)
    )
    await rm(path.join(dir, "2026-01-02_10-00-00.meta.json"))

    const entries = await listBackups()

    expect(entries.map((entry) => entry.filename)).toEqual([
      newer.filename,
      older.filename,
    ])
    expect(entries[0]?.tables).toBeNull()
    expect(entries[1]?.tables).toEqual(["t"])
    expect(entries[1]?.createdAt).toBe(
      new Date(2026, 0, 1, 10, 0).toISOString()
    )
    expect(entries[1]?.sizeBytes).toBe(1)
  })

  it("listBackups degrades a corrupt sidecar to tables: null", async () => {
    await writeBackupFile("a", ["t"], new Date(2026, 0, 1, 10, 0))
    await writeBackupFile("b", ["t"], new Date(2026, 0, 2, 10, 0))
    await writeFile(
      path.join(dir, "2026-01-01_10-00-00.meta.json"),
      "{ not json"
    )
    await writeFile(
      path.join(dir, "2026-01-02_10-00-00.meta.json"),
      JSON.stringify({ createdAt: 123, tables: ["t"] })
    )

    const entries = await listBackups()

    expect(entries).toHaveLength(2)
    expect(entries.map((entry) => entry.tables)).toEqual([null, null])
  })

  it("listBackups skips an entry whose stat raises ENOENT (deleted after readdir)", async () => {
    const older = await writeBackupFile(
      "a",
      ["t"],
      new Date(2026, 0, 1, 10, 0)
    )
    const newer = await writeBackupFile(
      "b",
      ["t"],
      new Date(2026, 0, 2, 10, 0)
    )

    fsControl.enoentStatOn = path.join(dir, newer.filename)

    const entries = await listBackups()

    expect(entries.map((entry) => entry.filename)).toEqual([
      older.filename,
    ])
  })

  it("listBackups ignores non-backup files", async () => {
    await writeFile(path.join(dir, "notes.txt"), "x")
    await writeFile(path.join(dir, "foo.sql"), "x")
    await writeFile(path.join(dir, "2026-01-01_10-00-00.sql.bak"), "x")

    expect(await listBackups()).toEqual([])
  })

  it("listBackups returns an empty list when the directory does not exist", async () => {
    await rm(dir, { recursive: true, force: true })

    expect(await listBackups()).toEqual([])
  })

  it("resolveBackupSqlPath accepts valid names and throws NOT_FOUND otherwise", () => {
    expect(() => resolveBackupSqlPath("../secret.sql")).toThrow(
      ActionError
    )
    expect(() => resolveBackupSqlPath("../secret.sql")).toThrow(
      "NOT_FOUND"
    )
    expect(() => resolveBackupSqlPath("nope.sql")).toThrow("NOT_FOUND")
    expect(() => resolveBackupSqlPath("/etc/passwd")).toThrow(
      "NOT_FOUND"
    )

    const resolved = resolveBackupSqlPath("2026-11-02_14-30-00.sql")
    expect(resolved).toContain("2026-11-02_14-30-00.sql")
    expect(resolved).toBe(
      path.join(path.resolve(dir), "2026-11-02_14-30-00.sql")
    )
  })
})
