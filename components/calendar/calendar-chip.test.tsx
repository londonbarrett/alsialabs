import { GridEvent } from "@/lib/calendar/components/grid-event"
import { MonthEvent } from "@/lib/calendar/components/month-event"
import type { CalendarEvent, GridEventPosition } from "@/lib/calendar/types"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/components/calendar/event-detail-dialog", () => ({
  EventDetailDialog: () => null,
}))

const event: CalendarEvent = {
  id: "e1",
  title: "Clean the studio",
  start: new Date(2026, 10, 24, 21, 0),
  end: new Date(2026, 10, 25, 0, 0),
  meta: {
    kind: "task",
    status: "todo",
    timeZone: "America/Bogota",
    startTime: "21:00",
  },
}

describe("calendar chips", () => {
  it("does not label a month chip with the project zone", () => {
    const markup = renderToStaticMarkup(
      <MonthEvent event={event} locale="en" />
    )

    expect(markup).toContain("Clean the studio")
    expect(markup).not.toContain("America/Bogota")
  })

  it("does not label a grid chip with the project zone", () => {
    const position: GridEventPosition = {
      event,
      top: 0,
      height: 32,
      width: 100,
      left: 0,
      zIndex: 0,
    }
    const markup = renderToStaticMarkup(
      <GridEvent position={position} locale="en" />
    )

    expect(markup).toContain("Clean the studio")
    expect(markup).not.toContain("America/Bogota")
  })
})
