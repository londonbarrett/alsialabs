import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import {
  CLOSED_TASK_STATUSES,
  closedCostDelta,
  closedCostSql,
  sumMoney,
} from "./total"

describe("closedCostDelta", () => {
  it("ignores open assignments on both sides", () => {
    expect(
      closedCostDelta(
        { cost: "100", terminal: false },
        { cost: "150", terminal: false }
      )
    ).toBe(0)
  })

  it("returns the cost change for terminal assignments", () => {
    expect(
      closedCostDelta(
        { cost: "100", terminal: true },
        { cost: "150", terminal: true }
      )
    ).toBe(50)
  })

  it("adds the cost when a row closes", () => {
    expect(
      closedCostDelta(
        { cost: "100", terminal: false },
        { cost: "100", terminal: true }
      )
    ).toBe(100)
  })

  it("subtracts the cost when a row reopens", () => {
    expect(
      closedCostDelta(
        { cost: "100", terminal: true },
        { cost: "100", terminal: false }
      )
    ).toBe(-100)
  })
})

describe("sumMoney", () => {
  it("adds numbers and numeric strings, treating empty values as zero", () => {
    expect(sumMoney(["10.75", 5, null, undefined])).toBe(15.75)
  })
})

describe("closedCostSql", () => {
  it("sums only the closed statuses", () => {
    expect(CLOSED_TASK_STATUSES).toEqual(["done", "cancelled"])

    const expression = closedCostSql(sql`cost`, sql`status`)
    const text = JSON.stringify(expression.queryChunks).toLowerCase()

    expect(text).toContain("case when")
    expect(text).toContain('"done"')
    expect(text).toContain('"cancelled"')
    expect(text).toContain("sum(")
  })
})
