import { describe, expect, it, vi } from "vitest"

import { wallClockToInstant } from "@/lib/time/zone"
import {
  formatAssignmentDueDate,
  formatDueDate,
  isAllDayWindow,
  resolveOptimisticWindow,
} from "./tasks"

const zone = "America/Bogota"

const at = (dateKey: string, time: string | null = null): Date =>
  new Date(wallClockToInstant(dateKey, time, zone)!.epochMilliseconds)

describe("isAllDayWindow", () => {
  it("recognizes a single-timestamp window from raw driver strings", () => {
    expect(
      isAllDayWindow(
        "2026-11-25T05:00:00.000Z",
        "2026-11-25T05:00:00.000Z"
      )
    ).toBe(true)
    expect(
      isAllDayWindow(at("2026-11-25"), at("2026-11-25"))
    ).toBe(true)
  })

  it("rejects timed windows and missing dates", () => {
    expect(
      isAllDayWindow(at("2026-11-25", "09:00"), at("2026-11-25", "11:00"))
    ).toBe(false)
    expect(isAllDayWindow(null, null)).toBe(false)
  })
})

describe("formatDueDate", () => {
  it("renders the project-zone date, not the host/UTC date", () => {
    // 2026-11-25T02:00Z is already 25 November in UTC but 21:00 on 24 November
    // in Bogotá. In the project zone the cell must read "Nov 24".
    const instant = new Date("2026-11-25T02:00:00Z")

    expect(formatDueDate(instant, "en-US", zone, null)).toBe("Nov 24")
    expect(formatDueDate(instant, "en-US", "UTC", null)).toBe("Nov 25")
  })

  it("drops the time-of-day for an all-day task whatever its stored hour", () => {
    const label = formatDueDate(at("2026-11-20", "09:00"), "en-US", zone, null)

    expect(label).not.toContain(":")
    expect(label).toContain("20")
  })

  it("keeps the time for a timed task", () => {
    const label = formatDueDate(
      at("2026-11-20", "09:00"),
      "en-US",
      zone,
      "09:00"
    )

    expect(label).toContain(":")
    expect(label).toContain("20")
  })

  it("uses the supplied startTime rather than inferring all-day from the hour", () => {
    // A project-zone midnight instant with a real startTime is still timed.
    const label = formatDueDate(at("2026-11-25"), "en-US", zone, "09:00")

    expect(label).toContain(":")
    expect(label).toContain("25")
  })
})

describe("formatAssignmentDueDate", () => {
  it("drops the time for an all-day occurrence whatever its stored hour", () => {
    const label = formatAssignmentDueDate(
      new Date("2026-11-25T02:00:00Z"),
      "es-ES",
      zone,
      null
    )

    expect(label).not.toContain(":")
    expect(label).toContain("24 nov")
  })

  it("shows the project-zone due time for timed work", () => {
    const label = formatAssignmentDueDate(
      new Date("2026-11-20T22:00:00Z"), // 17:00 in Bogotá
      "es-ES",
      zone,
      "17:00"
    )

    expect(label).toContain(":")
    expect(label).toContain("17:00")
  })

  it("formats with the requested locale", () => {
    const date = new Date("2026-11-20T22:00:00Z")
    expect(formatAssignmentDueDate(date, "es-ES", zone, "17:00")).toContain(
      "20 nov"
    )
  })
})

describe("resolveOptimisticWindow", () => {
  it("resolves a 09:00 wall clock in Bogotá to 14:00Z, not UTC midnight", () => {
    expect(
      resolveOptimisticWindow("2026-11-25", "09:00", "America/Bogota")
        ?.toISOString()
    ).toBe("2026-11-25T14:00:00.000Z")
  })

  it("resolves an all-day (empty time) key to project-zone midnight", () => {
    expect(
      resolveOptimisticWindow("2026-11-25", "", "America/Bogota")
        ?.toISOString()
    ).toBe("2026-11-25T05:00:00.000Z")
  })

  it("uses the submitted end time for the task's end instant", () => {
    expect(
      resolveOptimisticWindow("2026-11-25", "11:00", "Europe/Madrid")
        ?.toISOString()
    ).toBe("2026-11-25T10:00:00.000Z")
  })

  it("keeps null for a missing date on a one-off task", () => {
    expect(resolveOptimisticWindow(null, "09:00", "America/Bogota")).toBeNull()
  })

  it("falls back to now only when a repeating task has no date key", () => {
    const before = Date.now()
    const resolved = resolveOptimisticWindow(
      null,
      "09:00",
      "America/Bogota",
      true
    )
    expect(resolved).toBeInstanceOf(Date)
    expect(resolved!.getTime()).toBeGreaterThanOrEqual(before)
  })

  it("does not invent an instant for malformed wall-clock input", () => {
    expect(
      resolveOptimisticWindow("not-a-date", "09:00", "America/Bogota")
    ).toBeNull()
  })

  it("shifts a nonexistent spring-forward wall clock forward", () => {
    expect(
      resolveOptimisticWindow("2026-03-08", "02:30", "America/New_York")
        ?.toISOString()
    ).toBe("2026-03-08T07:30:00.000Z")
  })

  it("picks the earlier instant for an ambiguous fall-back wall clock", () => {
    expect(
      resolveOptimisticWindow("2026-10-25", "02:30", "Europe/Madrid")
        ?.toISOString()
    ).toBe("2026-10-25T00:30:00.000Z")
  })

  it("works when Temporal is unavailable in the browser", () => {
    vi.stubGlobal("Temporal", undefined)
    try {
      expect((globalThis as { Temporal?: unknown }).Temporal).toBeUndefined()
      expect(
        resolveOptimisticWindow("2026-11-25", "09:00", "America/Bogota")
          ?.toISOString()
      ).toBe("2026-11-25T14:00:00.000Z")
      expect(
        resolveOptimisticWindow("2026-11-25", "", "America/Bogota")
          ?.toISOString()
      ).toBe("2026-11-25T05:00:00.000Z")
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
