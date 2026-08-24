import type { CalendarEvent, GridEventPosition } from "../types"
import {
  clampDate,
  endOfDay,
  isBefore,
  minutesSinceMidnight,
  startOfDay,
} from "./date"

const MIN_EVENT_HEIGHT = 12

interface ClusterEvent extends CalendarEvent {
  col: number
}

/**
 * Lays out timed events of a single day into positioned blocks, resolving
 * overlaps by splitting the day column into sub-columns (like macOS Calendar).
 *
 * `top` and `height` are pixel offsets within a column of `24 * hourHeight`
 * pixels, matching the fixed-hour-height time grid.
 */
export function layoutDayEvents(
  events: CalendarEvent[],
  day: Date,
  hourHeight: number
): GridEventPosition[] {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  const dayMs = dayEnd.getTime() - dayStart.getTime()

  const timed = events
    .filter(
      (e) =>
        !e.allDay &&
        isBefore(e.start, dayEnd) &&
        isBefore(dayStart, e.end)
    )
    .sort((a, b) => {
      const byStart = a.start.getTime() - b.start.getTime()
      if (byStart !== 0) return byStart
      return (
        b.end.getTime() -
        b.start.getTime() -
        (a.end.getTime() - a.start.getTime())
      )
    })

  const positions: GridEventPosition[] = []
  const clusters: ClusterEvent[][] = []
  let cluster: ClusterEvent[] = []
  let clusterEnd = -Infinity

  for (const event of timed) {
    if (cluster.length === 0 || event.start.getTime() < clusterEnd) {
      cluster.push(event as ClusterEvent)
      clusterEnd = Math.max(clusterEnd, event.end.getTime())
    } else {
      clusters.push(cluster)
      cluster = [event as ClusterEvent]
      clusterEnd = event.end.getTime()
    }
  }
  if (cluster.length > 0) clusters.push(cluster)

  for (const eventsInCluster of clusters) {
    const colEnds: number[] = []
    for (const event of eventsInCluster) {
      let col = colEnds.findIndex((end) => event.start.getTime() >= end)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(event.end.getTime())
      } else {
        colEnds[col] = Math.max(colEnds[col], event.end.getTime())
      }
      event.col = col
    }

    const cols = Math.max(1, colEnds.length)
    for (const event of eventsInCluster) {
      const clampStart = clampDate(event.start, dayStart, dayEnd)
      const clampEnd = clampDate(event.end, dayStart, dayEnd)

      const top = (minutesSinceMidnight(clampStart) / 60) * hourHeight
      const height = Math.max(
        MIN_EVENT_HEIGHT,
        ((clampEnd.getTime() - clampStart.getTime()) / dayMs) *
          24 *
          hourHeight
      )

      positions.push({
        event,
        top,
        height,
        width: 100 / cols,
        left: (event.col / cols) * 100,
        zIndex: cols > 1 ? 1 : 0,
      })
    }
  }

  return positions
}
