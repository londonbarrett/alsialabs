import { describe, expect, it } from "vitest"

import { instantToWallClock } from "@/lib/time/zone"
import {
  combineDateTime,
  computeScheduledFor,
  endOfDay,
  parseISODate,
  startOfDay,
  toDateKey,
} from "./schedule"

const daily = {
  recurrence: "daily" as const,
  interval: 1,
  daysOfWeek: [],
  time: "09:00",
}

describe("wall-clock form helpers", () => {
  it("round-trips a date key through parseISODate and toDateKey", () => {
    expect(toDateKey(parseISODate("2026-11-25"))).toBe("2026-11-25")
  })

  it("keeps start/end of day at local midnight and the last millisecond", () => {
    const day = parseISODate("2026-11-25")
    expect(startOfDay(day).getTime()).toBe(day.getTime())
    expect(endOfDay(day).getTime() - day.getTime()).toBe(
      24 * 60 * 60 * 1000 - 1
    )
  })

  it("builds a local date/time without consulting a zone", () => {
    const combined = combineDateTime("2026-11-25", "09:00")
    expect(toDateKey(combined!)).toBe("2026-11-25")
    expect(combined?.getHours()).toBe(9)
  })
})

describe("computeScheduledFor", () => {
  it("returns null when the schedule has no time", () => {
    expect(
      computeScheduledFor(new Date(), { ...daily, time: null }, "UTC")
    ).toBeNull()
  })

  it("keeps a daily 09:00 slot at the same wall-clock hour across spring-forward", () => {
    // Saturday 2026-03-07 09:00 EST -> Sunday 2026-03-08 09:00 EDT: the clock
    // change is between them, but the wall-clock hour must not move.
    const next = computeScheduledFor(
      new Date("2026-03-07T14:00:00Z"),
      daily,
      "America/New_York"
    )

    expect(next).toEqual(new Date("2026-03-08T13:00:00Z"))
    expect(instantToWallClock(next!, "America/New_York")).toEqual({
      date: "2026-03-08",
      time: "09:00",
    })
  })

  it("schedules in the requested zone rather than the host zone", () => {
    const next = computeScheduledFor(
      new Date("2026-03-07T14:00:00Z"),
      daily,
      "America/Bogota"
    )

    expect(next).toEqual(new Date("2026-03-08T14:00:00Z"))
    expect(instantToWallClock(next!, "America/Bogota")).toEqual({
      date: "2026-03-08",
      time: "09:00",
    })
  })

  it("keeps an inclusive slot that lands exactly on `from`", () => {
    const from = new Date("2026-03-02T14:00:00Z")

    expect(computeScheduledFor(from, daily, "America/Bogota")).toEqual(
      new Date("2026-03-03T14:00:00Z")
    )
    expect(
      computeScheduledFor(from, daily, "America/Bogota", { inclusive: true })
    ).toEqual(from)
  })
})
