import { sql, type SQL } from "drizzle-orm"

import { CLOSED_TASK_STATUSES } from "./status"

export { CLOSED_TASK_STATUSES }
// The client-side helpers live in a drizzle-free module so the browser bundle
// never pulls `drizzle-orm` in; they are re-exported here for server callers.
export { closedCostDelta, sumMoney } from "./delta"

/**
 * The single SQL expression for closed-assignment cost: committed sums always
 * happen in the database through this helper.
 */
export function closedCostSql(
  costColumn: SQL,
  statusColumn: SQL
): SQL<string> {
  const closedStatuses = sql.join(
    CLOSED_TASK_STATUSES.map((status) => sql`${status}`),
    sql`, `
  )

  return sql<string>`coalesce(sum(case when ${statusColumn} in (${closedStatuses}) then ${costColumn} else 0 end), 0)::text`
}
