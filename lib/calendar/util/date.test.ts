import { describe, expect, it } from "vitest"

import type { CalendarEvent } from "../types"
import { formatWhen } from "./date"

const taskEvent: CalendarEvent = {
  id: "e1",
  title: "Clean the studio",
  // Deliberately different from the real instant: the grid Date is a
  // wall-clock placeholder in host-local time.
  start: new Date(2026, 10, 25, 2, 0),
  end: new Date(2026, 10, 25, 4, 0),
  meta: {
    kind: "task",
    timeZone: "America/Bogota",
    startDateIso: "2026-11-25T02:00:00.000Z",
    endDateIso: "2026-11-25T04:00:00.000Z",
  },
}

describe("formatWhen", () => {
  it("formats the real instant in the event's project zone", () => {
    const label = formatWhen(taskEvent, "en-US")

    // 02:00Z–04:00Z is 21:00–23:00 on Nov 24 in Bogotá, regardless of host TZ.
    expect(label).toContain("Nov 24")
    expect(label).toContain("9:00 PM")
    expect(label).toContain("11:00 PM")
  })

  it("formats all-day instants date-only in the project zone", () => {
    const label = formatWhen({ ...taskEvent, allDay: true }, "en-US")

    expect(label).toBe("Nov 24, 2026")
  })

  it("falls back to the grid Dates for events without app metadata", () => {
    const event: CalendarEvent = {
      id: "e2",
      title: "Meeting",
      start: new Date(2026, 10, 25, 9, 0),
      end: new Date(2026, 10, 25, 10, 0),
    }

    const label = formatWhen(event, "en-US")

    expect(label).toContain("Nov 25")
    expect(label).toContain("9:00 AM")
  })
})
