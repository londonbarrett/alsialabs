import { execFile, spawn, type ChildProcess } from "node:child_process"
import path from "node:path"

import { rewriteLoopbackHost, sanitizeDbUrl } from "./db-url"

export type ToolResult = { ok: boolean; stdout: string; stderr: string }

function probe(tool: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile(tool, ["--version"], (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function probeAvailable(tool: string): Promise<boolean> {
  try {
    await probe(tool)
    return true
  } catch {
    return false
  }
}

function collect(child: ChildProcess): Promise<ToolResult> {
  return new Promise<ToolResult>((resolve) => {
    let stdout = ""
    let stderr = ""
    let settled = false
    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      resolve({ ok: code === 0, stdout, stderr })
    }
    child.stdout?.setEncoding("utf8")
    child.stderr?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk
    })
    child.on("error", (error: Error) => {
      if (settled) return
      stderr = stderr ? `${stderr}\n${error.message}` : error.message
      finish(null)
    })
    child.on("close", (code) => {
      finish(code)
    })
  })
}

async function runTool(
  tool: string,
  hostArgs: readonly string[],
  dockerArgs: readonly string[]
): Promise<ToolResult> {
  if (await probeAvailable(tool)) {
    return collect(spawn(tool, [...hostArgs]))
  }
  return collect(spawn("docker", [...dockerArgs]))
}

const DUMP_FLAGS = [
  "--no-owner",
  "--no-privileges",
  "--clean",
  "--if-exists",
  "--no-password",
] as const

const RESTORE_FLAGS = [
  "--no-password",
  "-v",
  "ON_ERROR_STOP=1",
  "--single-transaction",
] as const

function quoteTable(table: string): string {
  return `public."${table.replace(/"/g, '""')}"`
}

export async function pgDump(
  tables: string[],
  url: string
): Promise<ToolResult> {
  const sanitized = sanitizeDbUrl(url)
  const toolArgs = [
    ...DUMP_FLAGS,
    ...tables.flatMap((table) => ["-t", quoteTable(table)]),
  ]
  return runTool(
    "pg_dump",
    [...toolArgs, sanitized],
    [
      "run",
      "--rm",
      "postgres:17-alpine",
      "pg_dump",
      ...toolArgs,
      rewriteLoopbackHost(sanitized),
    ]
  )
}

export async function restoreSql(
  hostFilePath: string,
  url: string
): Promise<ToolResult> {
  const sanitized = sanitizeDbUrl(url)
  const dir = path.dirname(hostFilePath)
  const target = `/backups/${path.basename(hostFilePath)}`
  return runTool(
    "psql",
    [...RESTORE_FLAGS, "-f", hostFilePath, sanitized],
    [
      "run",
      "--rm",
      "-i",
      "-v",
      `${dir}:/backups:ro`,
      "postgres:17-alpine",
      "psql",
      ...RESTORE_FLAGS,
      "-f",
      target,
      rewriteLoopbackHost(sanitized),
    ]
  )
}
