"use client"

import { memo, useEffect, useState } from "react"
import { minutesSinceMidnight } from "../util/date"

interface GridTimeIndicatorProps {
  hourHeight: number
}

export const GridTimeIndicator = memo(function GridTimeIndicator({
  hourHeight,
}: GridTimeIndicatorProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const top = minutesSinceMidnight(now) * (hourHeight / 60)

  return (
    <div
      className="absolute inset-x-0 z-10 border-t-2 border-destructive"
      style={{ top }}
    >
      <span className="absolute -top-1 -left-1 size-1.5 rounded-full bg-destructive" />
    </div>
  )
})
