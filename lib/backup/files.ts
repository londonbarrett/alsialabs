import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
import path from "node:path"

import { throwActionError } from "@/lib/action-result"

import { backupBaseName, isBackupFilename } from "./filename"

export type BackupEntry = {
  filename: string
  createdAt: string
  sizeBytes: number
  tables: string[] | null
}

type Sidecar = {
  createdAt: string
  tables: string[]
}

export function backupDir(): string {
  return path.resolve(
    process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups")
  )
}

function sidecarPath(sqlPath: string): string {
  return sqlPath.replace(/\.sql$/, ".meta.json")
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

function isEEXIST(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "EEXIST"
}

function isSidecar(value: unknown): value is Sidecar {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { createdAt?: unknown; tables?: unknown }
  if (typeof candidate.createdAt !== "string") return false
  if (Number.isNaN(Date.parse(candidate.createdAt))) return false
  if (!Array.isArray(candidate.tables)) return false
  if (
    !candidate.tables.every(
      (table: unknown) => typeof table === "string"
    )
  ) {
    return false
  }
  return true
}

async function readSidecar(sqlPath: string): Promise<Sidecar | null> {
  try {
    const raw = await readFile(sidecarPath(sqlPath), "utf8")
    const parsed: unknown = JSON.parse(raw)
    return isSidecar(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function writeBackupFile(
  sql: string,
  tables: string[],
  now: Date = new Date()
): Promise<BackupEntry> {
  const dir = backupDir()
  await mkdir(dir, { recursive: true })
  const base = backupBaseName(now)
  const createdAt = now.toISOString()
  const sidecarJson = JSON.stringify({ createdAt, tables })

  let attempt = 0
  for (;;) {
    const filename =
      attempt === 0 ? `${base}.sql` : `${base}-${attempt}.sql`
    const sqlPath = path.join(dir, filename)
    const metaPath = sidecarPath(sqlPath)

    if ((await pathExists(sqlPath)) || (await pathExists(metaPath))) {
      attempt += 1
      continue
    }

    try {
      await writeFile(metaPath, sidecarJson, {
        flag: "wx",
        encoding: "utf8",
      })
    } catch (error) {
      if (isEEXIST(error)) {
        attempt += 1
        continue
      }
      await unlink(metaPath).catch(() => undefined)
      throw error
    }

    try {
      await writeFile(sqlPath, sql, { flag: "wx", encoding: "utf8" })
    } catch (error) {
      await unlink(metaPath).catch(() => undefined)
      if (isEEXIST(error)) {
        attempt += 1
        continue
      }
      await unlink(sqlPath).catch(() => undefined)
      throw error
    }

    const info = await stat(sqlPath)
    return { filename, createdAt, sizeBytes: info.size, tables }
  }
}

async function loadBackupEntry(
  dir: string,
  filename: string
): Promise<BackupEntry | null> {
  const sqlPath = path.join(dir, filename)
  try {
    const info = await stat(sqlPath)
    const sidecar = await readSidecar(sqlPath)
    return {
      filename,
      createdAt: sidecar?.createdAt ?? info.mtime.toISOString(),
      sizeBytes: info.size,
      tables: sidecar?.tables ?? null,
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  const dir = backupDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const entries = (
    await Promise.all(
      names
        .filter(isBackupFilename)
        .map((filename) => loadBackupEntry(dir, filename))
    )
  ).filter((entry): entry is BackupEntry => entry !== null)
  entries.sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )
  return entries
}

export function resolveBackupSqlPath(filename: string): string {
  try {
    if (!isBackupFilename(filename)) throwActionError("NOT_FOUND")
    const dir = backupDir()
    const resolved = path.join(dir, filename)
    if (!resolved.startsWith(dir + path.sep))
      throwActionError("NOT_FOUND")
    return resolved
  } catch {
    return throwActionError("NOT_FOUND")
  }
}
