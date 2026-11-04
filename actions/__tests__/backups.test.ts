import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
  isSuperUser: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock("@/actions/not-safe/stores", () => ({
  getEffectiveStoreId: vi.fn(),
}))

vi.mock("@/actions/projects/util", () => ({
  resolveProjectAccess: vi.fn(),
}))

vi.mock("@/lib/backup/tables", () => ({
  listPublicTables: vi.fn(),
  listDependentViews: vi.fn(),
  validateTableSelection: vi.fn(),
}))

vi.mock("@/lib/backup/files", () => ({
  writeBackupFile: vi.fn(),
  resolveBackupSqlPath: vi.fn(),
}))

vi.mock("@/lib/backup/exec", () => ({
  pgDump: vi.fn(),
  restoreSql: vi.fn(),
}))

import { auth, isSuperUser } from "@/lib/auth"
import {
  listPublicTables,
  listDependentViews,
  validateTableSelection,
} from "@/lib/backup/tables"
import {
  writeBackupFile,
  resolveBackupSqlPath,
} from "@/lib/backup/files"
import { pgDump, restoreSql } from "@/lib/backup/exec"
import { throwActionError } from "@/lib/action-result"
import { createBackup, restoreBackup } from "@/actions/backups"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockIsSuperUser = vi.mocked(isSuperUser)
const mockListPublicTables = vi.mocked(listPublicTables)
const mockListDependentViews = vi.mocked(listDependentViews)
const mockValidateTableSelection = vi.mocked(validateTableSelection)
const mockWriteBackupFile = vi.mocked(writeBackupFile)
const mockResolveBackupSqlPath = vi.mocked(resolveBackupSqlPath)
const mockPgDump = vi.mocked(pgDump)
const mockRestoreSql = vi.mocked(restoreSql)

const originalDbDirectUrl = process.env.DB_DIRECT_URL
const DB_DIRECT_URL = "postgresql://user:pass@db.example:5432/postgres"

const entry = {
  filename: "2026-11-02_14-30-00.sql",
  createdAt: "2026-11-02T14:30:00.000Z",
  sizeBytes: 7,
  tables: ["role"],
}

const sqlPath = "/backups/2026-11-02_14-30-00.sql"

function superSession() {
  return {
    user: { id: "super-1", role: "super", name: "Super" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

function userSession() {
  return {
    user: { id: "user-1", role: "user", name: "User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DB_DIRECT_URL = DB_DIRECT_URL
  mockAuth.mockResolvedValue(superSession())
  mockIsSuperUser.mockReturnValue(true)
  mockListPublicTables.mockResolvedValue(["role", "users"])
  mockListDependentViews.mockResolvedValue([])
  mockValidateTableSelection.mockImplementation(() => undefined)
  mockPgDump.mockResolvedValue({
    ok: true,
    stdout: "-- dump",
    stderr: "",
  })
  mockWriteBackupFile.mockResolvedValue(entry)
  mockResolveBackupSqlPath.mockReturnValue(sqlPath)
  mockRestoreSql.mockResolvedValue({ ok: true, stdout: "", stderr: "" })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  if (originalDbDirectUrl === undefined) {
    delete process.env.DB_DIRECT_URL
  } else {
    process.env.DB_DIRECT_URL = originalDbDirectUrl
  }
})

describe("createBackup", () => {
  it("returns FORBIDDEN for a non-super session", async () => {
    mockAuth.mockResolvedValue(userSession())
    mockIsSuperUser.mockReturnValue(false)
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "FORBIDDEN" })
    expect(mockListPublicTables).not.toHaveBeenCalled()
    expect(mockValidateTableSelection).not.toHaveBeenCalled()
    expect(mockPgDump).not.toHaveBeenCalled()
    expect(mockWriteBackupFile).not.toHaveBeenCalled()
  })

  it("rejects a selection that fails validation before pg_dump", async () => {
    mockValidateTableSelection.mockImplementation(() =>
      throwActionError("INVALID_TABLE_SELECTION")
    )
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "INVALID_TABLE_SELECTION" })
    expect(mockListPublicTables).toHaveBeenCalledWith()
    expect(mockValidateTableSelection).toHaveBeenCalledWith(
      ["role"],
      ["role", "users"]
    )
    expect(mockPgDump).not.toHaveBeenCalled()
    expect(mockWriteBackupFile).not.toHaveBeenCalled()
  })

  it("returns BACKUP_FAILED when pg_dump fails, logging stderr", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockPgDump.mockResolvedValue({
      ok: false,
      stdout: "",
      stderr: "docker down",
    })
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "BACKUP_FAILED" })
    expect(mockPgDump).toHaveBeenCalledWith(["role"], DB_DIRECT_URL)
    expect(mockWriteBackupFile).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(
      "[backup] pg_dump failed:",
      "docker down"
    )
    spy.mockRestore()
  })

  it("returns INTERNAL_SERVER_ERROR when DB_DIRECT_URL is missing", async () => {
    delete process.env.DB_DIRECT_URL
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toEqual({ code: "INTERNAL_SERVER_ERROR" })
    expect(mockListPublicTables).not.toHaveBeenCalled()
    expect(mockPgDump).not.toHaveBeenCalled()
    expect(mockWriteBackupFile).not.toHaveBeenCalled()
  })

  it("writes the dump and returns the entry on success", async () => {
    mockPgDump.mockResolvedValue({
      ok: true,
      stdout: "-- dump",
      stderr: "",
    })
    mockWriteBackupFile.mockResolvedValue(entry)
    const res = await createBackup({ tables: ["role"] })
    expect(res.serverError).toBeUndefined()
    expect(res.data?.filename).toBe("2026-11-02_14-30-00.sql")
    expect(res.data).toEqual(entry)
    expect(mockValidateTableSelection).toHaveBeenCalledWith(
      ["role"],
      ["role", "users"]
    )
    expect(mockWriteBackupFile).toHaveBeenCalledWith("-- dump", [
      "role",
    ])
    expect(
      mockValidateTableSelection.mock.invocationCallOrder[0]
    ).toBeLessThan(mockPgDump.mock.invocationCallOrder[0])
  })

  it("dumps and records dependent views alongside the selected tables", async () => {
    mockListDependentViews.mockResolvedValue(["task_assignment_detail"])
    const res = await createBackup({ tables: ["user"] })
    expect(res.serverError).toBeUndefined()
    expect(mockListDependentViews).toHaveBeenCalledWith(["user"])
    expect(mockPgDump).toHaveBeenCalledWith(
      ["user", "task_assignment_detail"],
      DB_DIRECT_URL
    )
    expect(mockWriteBackupFile).toHaveBeenCalledWith("-- dump", [
      "user",
      "task_assignment_detail",
    ])
  })
})

describe("restoreBackup", () => {
  it("returns FORBIDDEN for a non-super session", async () => {
    mockAuth.mockResolvedValue(userSession())
    mockIsSuperUser.mockReturnValue(false)
    const res = await restoreBackup({
      filename: "2026-11-02_14-30-00.sql",
    })
    expect(res.serverError).toEqual({ code: "FORBIDDEN" })
    expect(mockResolveBackupSqlPath).not.toHaveBeenCalled()
    expect(mockRestoreSql).not.toHaveBeenCalled()
  })

  it("returns NOT_FOUND for an invalid filename", async () => {
    mockResolveBackupSqlPath.mockImplementation(() =>
      throwActionError("NOT_FOUND")
    )
    const res = await restoreBackup({ filename: "../etc/passwd.sql" })
    expect(res.serverError).toEqual({ code: "NOT_FOUND" })
    expect(mockRestoreSql).not.toHaveBeenCalled()
  })

  it("returns RESTORE_FAILED when psql fails, logging stderr", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockRestoreSql.mockResolvedValue({
      ok: false,
      stdout: "",
      stderr: "psql: error",
    })
    const res = await restoreBackup({
      filename: "2026-11-02_14-30-00.sql",
    })
    expect(res.serverError).toEqual({ code: "RESTORE_FAILED" })
    expect(mockRestoreSql).toHaveBeenCalledWith(sqlPath, DB_DIRECT_URL)
    expect(spy).toHaveBeenCalledWith(
      "[backup] psql failed:",
      "psql: error"
    )
    spy.mockRestore()
  })

  it("returns { filename } on success", async () => {
    const res = await restoreBackup({
      filename: "2026-11-02_14-30-00.sql",
    })
    expect(res.serverError).toBeUndefined()
    expect(res.data).toEqual({ filename: "2026-11-02_14-30-00.sql" })
    expect(mockResolveBackupSqlPath).toHaveBeenCalledWith(
      "2026-11-02_14-30-00.sql"
    )
    expect(mockRestoreSql).toHaveBeenCalledWith(sqlPath, DB_DIRECT_URL)
  })
})
