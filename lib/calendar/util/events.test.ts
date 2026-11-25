import { describe, expect, it } from "vitest"

import type { CalendarAssignmentDTO } from "@/actions/calendar/schemas"
import { toDateKey } from "@/lib/util/schedule"
import { buildCalendarEvents } from "./events"

function assignment(
  overrides: Partial<CalendarAssignmentDTO> = {}
): CalendarAssignmentDTO {
  return {
    assignmentId: "a1",
    taskId: "t1",
    taskName: "Clean the studio",
    status: "todo",
    priority: null,
    startDate: new Date("2026-10-30T09:00:00.000Z"),
    endDate: new Date("2026-10-30T11:00:00.000Z"),
    timeZone: "UTC",
    startTime: "09:00",
    dateKey: "2026-10-30",
    projectId: "p1",
    projectName: "Home",
    projectColor: "#3b82f6",
    projectOwnerName: "Owner",
    userName: "Ana",
    userImage: null,
    comment: null,
    commentCount: 0,
    recurrence: null,
    ...overrides,
  }
}

const from = new Date(2026, 9, 29)
const to = new Date(2026, 10, 2, 23, 59)
const wideFrom = new Date("2026-11-01T00:00:00.000Z")
const wideTo = new Date("2026-11-30T00:00:00.000Z")

describe("buildCalendarEvents", () => {
  it("groups same-day assignments of one task into one event", () => {
    const events = buildCalendarEvents(
      [
        assignment({ assignmentId: "a1", userName: "Ana" }),
        assignment({ assignmentId: "a2", userName: "Bob" }),
      ],
      from,
      to
    )

    expect(events).toHaveLength(1)
    expect(events[0]?.meta?.assignees).toHaveLength(2)
    expect(events[0]?.title).toBe("Clean the studio")
  })

  it("keeps assignments on different days apart", () => {
    const events = buildCalendarEvents(
      [
        assignment({ assignmentId: "a1" }),
        assignment({
          assignmentId: "a2",
          startDate: new Date("2026-10-31T09:00:00.000Z"),
          endDate: new Date("2026-10-31T11:00:00.000Z"),
          dateKey: "2026-10-31",
        }),
      ],
      from,
      to
    )

    expect(events).toHaveLength(2)
  })

  it("gives an all-day (midnight-to-midnight) event an exclusive end", () => {
    const events = buildCalendarEvents(
      [
        assignment({
          startDate: new Date("2026-10-30T00:00:00.000Z"),
          endDate: new Date("2026-10-30T00:00:00.000Z"),
          startTime: null,
        }),
      ],
      from,
      to
    )

    expect(events).toHaveLength(1)
    expect(events[0]!.allDay).toBe(true)
    // The week/day all-day lane drops events whose end is not strictly
    // after the day start — the exclusive end keeps midnight tasks visible.
    expect(events[0]!.end.getTime()).toBe(
      new Date(2026, 9, 31, 0, 0).getTime()
    )
    expect(events[0]!.end.getTime()).toBeGreaterThan(
      events[0]!.start.getTime()
    )
  })

  it("keeps a timed window that merely starts at midnight as-is", () => {
    const events = buildCalendarEvents(
      [
        assignment({
          startDate: new Date("2026-10-30T00:00:00.000Z"),
          endDate: new Date("2026-10-30T17:00:00.000Z"),
          startTime: "00:00",
        }),
      ],
      from,
      to
    )

    expect(events[0]!.allDay).toBe(false)
    expect(events[0]!.meta?.endDateIso).toBe("2026-10-30T17:00:00.000Z")
    expect(toDateKey(events[0]!.end)).toBe("2026-10-30")
    expect(events[0]!.end.getHours()).toBe(17)
    expect(events[0]!.end.getTime()).toBeGreaterThan(
      events[0]!.start.getTime()
    )
  })

  it("places an instant on the date it has in its own project's zone", () => {
    const instant = new Date("2026-11-25T02:00:00.000Z")
    const end = new Date("2026-11-25T04:00:00.000Z")

    const bogota = buildCalendarEvents(
      [
        assignment({
          startDate: instant,
          endDate: end,
          timeZone: "America/Bogota",
          startTime: "21:00",
          dateKey: "2026-11-24",
        }),
      ],
      wideFrom,
      wideTo
    )
    const utc = buildCalendarEvents(
      [
        assignment({
          startDate: instant,
          endDate: end,
          dateKey: "2026-11-25",
        }),
      ],
      wideFrom,
      wideTo
    )

    // 02:00Z is 21:00 on Nov 24 in Bogotá but 02:00 on Nov 25 in UTC.
    expect(toDateKey(bogota[0]!.start)).toBe("2026-11-24")
    expect(toDateKey(utc[0]!.start)).toBe("2026-11-25")
    expect(bogota[0]!.meta?.timeZone).toBe("America/Bogota")
    expect(utc[0]!.meta?.timeZone).toBe("UTC")
    expect(bogota[0]!.meta?.startDateIso).toBe(instant.toISOString())
  })

  it("groups by each assignment's project-zone date, not the host-zone date", () => {
    const shared = { taskId: "shared" }
    const events = buildCalendarEvents(
      [
        assignment({
          ...shared,
          assignmentId: "a1",
          userName: "Ana",
          startDate: new Date("2026-11-24T23:30:00.000Z"),
          endDate: new Date("2026-11-25T01:00:00.000Z"),
          timeZone: "America/Bogota",
          startTime: "18:30",
          dateKey: "2026-11-24",
        }),
        assignment({
          ...shared,
          assignmentId: "a2",
          userName: "Bob",
          startDate: new Date("2026-11-25T02:00:00.000Z"),
          endDate: new Date("2026-11-25T04:00:00.000Z"),
          timeZone: "America/Bogota",
          startTime: "21:00",
          dateKey: "2026-11-24",
        }),
        assignment({
          ...shared,
          assignmentId: "a3",
          userName: "Cara",
          startDate: new Date("2026-11-25T02:00:00.000Z"),
          endDate: new Date("2026-11-25T04:00:00.000Z"),
          timeZone: "UTC",
          startTime: "02:00",
          dateKey: "2026-11-25",
        }),
      ],
      wideFrom,
      wideTo
    )

    // Both Bogotá instants are on Nov 24 there, although one is on Nov 24 and
    // the other on Nov 25 in a UTC host. The UTC assignment shares the instant
    // with the second Bogotá row but belongs to Nov 25 in its own zone.
    expect(events).toHaveLength(2)
    const bogota = events.find((e) => e.meta?.timeZone === "America/Bogota")
    const utc = events.find((e) => e.meta?.timeZone === "UTC")
    expect(bogota?.meta?.assignees).toHaveLength(2)
    expect(utc?.meta?.assignees).toHaveLength(1)
    expect(toDateKey(bogota!.start)).toBe("2026-11-24")
    expect(toDateKey(utc!.start)).toBe("2026-11-25")
  })

  it("derives all-day from startTime, never from the instant's hour", () => {
    const allDay = buildCalendarEvents(
      [
        assignment({
          startDate: new Date("2026-11-25T09:00:00.000Z"),
          endDate: new Date("2026-11-25T11:00:00.000Z"),
          startTime: null,
          dateKey: "2026-11-25",
        }),
      ],
      wideFrom,
      wideTo
    )
    expect(allDay[0]!.allDay).toBe(true)

    const timedAtMidnight = buildCalendarEvents(
      [
        assignment({
          startDate: new Date("2026-11-25T00:00:00.000Z"),
          endDate: new Date("2026-11-25T17:00:00.000Z"),
          startTime: "00:00",
          dateKey: "2026-11-25",
        }),
      ],
      wideFrom,
      wideTo
    )
    expect(timedAtMidnight[0]!.allDay).toBe(false)
    expect(timedAtMidnight[0]!.end.getTime()).toBeGreaterThan(
      timedAtMidnight[0]!.start.getTime()
    )
  })
})
