/** Delay before an inline assignment cost edit is persisted. */
export const COST_DEBOUNCE_MS = 1000

/**
 * Drizzle returns `decimal` columns as strings. Convert at the boundary where
 * arithmetic happens so views and stores never scatter `Number()` calls.
 */
export function costToNumber(value: string): number {
  return Number(value) || 0
}

export function sumCosts(rows: { cost: string }[]): number {
  return rows.reduce((sum, row) => sum + costToNumber(row.cost), 0)
}
