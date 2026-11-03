import { describe, expect, it } from "vitest"

import { backupBaseName, isBackupFilename } from "./filename"

describe("lib/backup/filename", () => {
  it("formats local time as YYYY-MM-DD_HH-mm-ss", () => {
    expect(backupBaseName(new Date(2026, 10, 2, 14, 30, 5))).toBe(
      "2026-11-02_14-30-05"
    )
  })

  it("accepts plain and collision-suffixed names", () => {
    expect(isBackupFilename("2026-11-02_14-30-00.sql")).toBe(true)
    expect(isBackupFilename("2026-11-02_14-30-00-2.sql")).toBe(true)
  })

  it("rejects traversal, absolute paths, and wrong extensions", () => {
    for (const bad of [
      "../../etc/passwd",
      "/etc/passwd",
      "2026-11-02_14-30-00.sql.bak",
      "2026-11-02 14:30:00.sql",
      "..%2F..%2Fetc%2Fpasswd",
      "a.sql",
      "",
    ]) {
      expect(isBackupFilename(bad)).toBe(false)
    }
  })
})
