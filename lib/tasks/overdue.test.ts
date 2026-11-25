import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"

import { wallClockToInstant } from "@/lib/time/zone"
import { isTaskOverdue } from "./overdue"

const zone = "America/Bogota"

const at = (dateKey: string, time: string | null = null): Date =>
  new Date(wallClockToInstant(dateKey, time, zone)!.epochMilliseconds)

describe("isTaskOverdue", () => {
  it("ignores missing dates and terminal statuses", () => {
    expect(isTaskOverdue("todo", null, zone, false)).toBe(false)
    expect(isTaskOverdue("done", at("2026-01-01", "12:00"), zone, false)).toBe(
      false
    )
    expect(
      isTaskOverdue("cancelled", at("2026-01-01", "12:00"), zone, false)
    ).toBe(false)
    expect(isTaskOverdue("todo", "not a date", zone, false)).toBe(false)
  })

  it("is overdue from the deadline itself for timed due dates", () => {
    expect(
      isTaskOverdue("todo", at("2026-01-01", "12:00"), zone, false)
    ).toBe(true)

    const future = new Date(Date.now() + 60 * 60 * 1000)
    expect(isTaskOverdue("todo", future, zone, false)).toBe(false)
  })

  it("holds an all-day deadline through the project-zone day", () => {
    vi.useFakeTimers()
    try {
      const due = at("2026-11-25")

      // 2026-11-25T13:00Z is 08:00 in Bogotá on the due day.
      vi.setSystemTime(new Date("2026-11-25T13:00:00Z"))
      expect(isTaskOverdue("todo", due, zone, true)).toBe(false)

      // 2026-11-26T05:00Z is midnight in Bogotá the next day.
      vi.setSystemTime(new Date("2026-11-26T05:00:00Z"))
      expect(isTaskOverdue("todo", due, zone, true)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

function sourceFiles(dir: string): string[] {
  const absolute = join(repoRoot, dir)
  return readdirSync(absolute).flatMap((entry) => {
    const path = join(absolute, entry)
    if (statSync(path).isDirectory()) return sourceFiles(join(dir, entry))
    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe("Temporal client boundary", () => {
  it("keeps lib/time/zone out of client-facing directories", () => {
    const offenders = ["components", "stores", "app"]
      .flatMap(sourceFiles)
      .filter((path) => readFileSync(path, "utf8").includes("lib/time/zone"))

    expect(offenders).toEqual([])
  })

  it("keeps the shared task utilities free of the zone module", () => {
    expect(readFileSync(join(repoRoot, "lib/util/tasks.ts"), "utf8")).not.toContain(
      "lib/time/zone"
    )
  })
})
