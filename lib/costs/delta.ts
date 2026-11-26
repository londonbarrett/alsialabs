import { costToNumber } from "@/lib/tasks/cost"

/**
 * The client mirror for one optimistic assignment change: new closed cost
 * minus old closed cost, zero when the row is open on either side.
 *
 * Drizzle-free on purpose: the browser bundle must never pull `drizzle-orm`
 * in, so this module — and everything the client imports from it — stays
 * independent of the SQL layer in `lib/costs/total.ts`.
 */
export function closedCostDelta(
  previous: { cost: string; terminal: boolean } | null,
  next: { cost: string; terminal: boolean } | null
): number {
  const before = previous?.terminal ? costToNumber(previous.cost) : 0
  const after = next?.terminal ? costToNumber(next.cost) : 0
  return after - before
}

/** Adds already-computed money values for display. */
export function sumMoney(
  values: (number | string | null | undefined)[]
): number {
  return values.reduce<number>(
    (sum, value) => sum + (Number(value) || 0),
    0
  )
}
