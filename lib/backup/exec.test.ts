import { EventEmitter } from "node:events"
import { StringDecoder } from "node:string_decoder"
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))

import { execFile, spawn } from "node:child_process"

import { pgDump, restoreSql } from "./exec"

type ProbeCallback = (
  error: Error | null,
  stdout: string,
  stderr: string
) => void

type ExecFileLike = (
  file: string,
  args: readonly string[],
  callback: ProbeCallback
) => void

type SpawnLike = (
  command: string,
  args: readonly string[]
) => EventEmitter

const execFileMock = execFile as unknown as Mock<ExecFileLike>
const spawnMock = spawn as unknown as Mock<SpawnLike>

class MockStream extends EventEmitter {
  private decoder: StringDecoder | null = null

  setEncoding(encoding: BufferEncoding): this {
    this.decoder = new StringDecoder(encoding)
    return this
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const chunk = args[0]
    if (event === "data" && this.decoder && Buffer.isBuffer(chunk)) {
      args[0] = this.decoder.write(chunk)
    }
    return super.emit(event, ...args)
  }
}

function mockProbeFound(): void {
  execFileMock.mockImplementation((file, args, callback) => {
    void args
    callback(null, `${file} (PostgreSQL) 17.11`, "")
  })
}

function mockProbeMissing(): void {
  execFileMock.mockImplementation((file, args, callback) => {
    void file
    void args
    const error = new Error(
      `spawn ${file} ENOENT`
    ) as NodeJS.ErrnoException
    error.code = "ENOENT"
    callback(error, "", "")
  })
}

interface SpawnOutcome {
  code?: number
  stdout?: string
  stderr?: string
  error?: string
  stdoutChunks?: readonly Buffer[]
}

function mockSpawn(outcome: SpawnOutcome = {}): void {
  const {
    code = 0,
    stdout = "",
    stderr = "",
    error,
    stdoutChunks,
  } = outcome
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: MockStream
      stderr: MockStream
    }
    child.stdout = new MockStream()
    child.stderr = new MockStream()
    queueMicrotask(() => {
      if (stdoutChunks) {
        for (const chunk of stdoutChunks)
          child.stdout.emit("data", chunk)
      } else if (stdout) {
        child.stdout.emit("data", Buffer.from(stdout, "utf8"))
      }
      if (stderr) child.stderr.emit("data", Buffer.from(stderr, "utf8"))
      if (error) {
        child.emit("error", new Error(error))
      } else {
        child.emit("close", code)
      }
    })
    return child
  })
}

function lastSpawn(): { command: string; args: readonly string[] } {
  const call = spawnMock.mock.calls.at(-1)
  if (!call) throw new Error("spawn was not called")
  return { command: call[0], args: call[1] }
}

describe("lib/backup/exec", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("uses host pg_dump when the probe succeeds", async () => {
    mockProbeFound()
    mockSpawn({ stdout: "SELECT 1" })
    const result = await pgDump(["role"], "postgres://x")
    const { command, args } = lastSpawn()
    expect(command).toBe("pg_dump")
    expect(command).not.toBe("docker")
    expect(args).toEqual([
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--no-password",
      "-t",
      'public."role"',
      "postgres://x",
    ])
    expect(result).toEqual({ ok: true, stdout: "SELECT 1", stderr: "" })
  })

  it("decodes multi-byte utf8 characters split across data chunks", async () => {
    mockProbeFound()
    const payload = 'CREATE TABLE "áñ" ()'
    const bytes = Buffer.from(payload, "utf8")
    const split = bytes.indexOf(Buffer.from("á", "utf8")) + 1
    mockSpawn({
      stdoutChunks: [bytes.subarray(0, split), bytes.subarray(split)],
    })
    const result = await pgDump(["t"], "postgres://x")
    expect(result.stdout).toBe(payload)
    expect(result.stdout).not.toContain("�")
  })

  it("falls back to docker with the postgres:17-alpine image", async () => {
    mockProbeMissing()
    mockSpawn()
    await pgDump(["role"], "postgres://x")
    const { command, args } = lastSpawn()
    expect(command).toBe("docker")
    expect(args).toEqual([
      "run",
      "--rm",
      "postgres:17-alpine",
      "pg_dump",
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--no-password",
      "-t",
      'public."role"',
      "postgres://x",
    ])
  })

  it("quotes table names for -t and doubles embedded quotes", async () => {
    mockProbeFound()
    mockSpawn()
    await pgDump(['we"ird'], "postgres://x")
    expect(lastSpawn().args).toContain('public."we""ird"')
  })

  it("rewrites loopback hosts only in the docker path", async () => {
    const url = "postgres://u:p@localhost:55432/db"

    mockProbeFound()
    mockSpawn()
    await pgDump(["t"], url)
    const host = lastSpawn()
    expect(host.command).toBe("pg_dump")
    expect(host.args).toContain(url)
    expect(host.args.join(" ")).not.toContain("host.docker.internal")

    mockProbeMissing()
    await pgDump(["t"], url)
    const docker = lastSpawn()
    expect(docker.command).toBe("docker")
    expect(docker.args).toContain(
      "postgres://u:p@host.docker.internal:55432/db"
    )
  })

  it("reports non-zero exit as ok:false with stderr", async () => {
    mockProbeFound()
    mockSpawn({ code: 1, stderr: "boom" })
    const result = await pgDump(["t"], "postgres://x")
    expect(result).toEqual({ ok: false, stdout: "", stderr: "boom" })
  })

  it("reports spawn errors as ok:false with the error message", async () => {
    mockProbeMissing()
    mockSpawn({ error: "spawn docker ENOENT" })
    const result = await pgDump(["t"], "postgres://x")
    expect(result.ok).toBe(false)
    expect(result.stderr).toContain("spawn docker ENOENT")
  })

  it("restoreSql passes single-transaction and ON_ERROR_STOP, and mounts the dir read-only under docker", async () => {
    const file = "/repo/backups/2026-11-02_14-30-00.sql"
    const url = "postgres://x"

    mockProbeFound()
    mockSpawn()
    await restoreSql(file, url)
    expect(lastSpawn()).toEqual({
      command: "psql",
      args: [
        "--no-password",
        "-v",
        "ON_ERROR_STOP=1",
        "--single-transaction",
        "-f",
        file,
        url,
      ],
    })

    mockProbeMissing()
    await restoreSql(file, url)
    expect(lastSpawn()).toEqual({
      command: "docker",
      args: [
        "run",
        "--rm",
        "-i",
        "-v",
        "/repo/backups:/backups:ro",
        "postgres:17-alpine",
        "psql",
        "--no-password",
        "-v",
        "ON_ERROR_STOP=1",
        "--single-transaction",
        "-f",
        "/backups/2026-11-02_14-30-00.sql",
        url,
      ],
    })
  })
})
