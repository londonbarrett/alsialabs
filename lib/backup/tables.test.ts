import { describe, expect, it, vi } from "vitest"
import { PgDialect } from "drizzle-orm/pg-core"

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }))

vi.mock("@/lib/drizzle/client", () => ({ db: { execute } }))

import { listDependentViews, validateTableSelection } from "./tables"

describe("lib/backup/tables", () => {
  it("rejects empty selection", () => {
    expect(() => validateTableSelection([], ["a"])).toThrow()
  })
  it("rejects unknown and metacharacter names", () => {
    const available = ["role", "user"]
    expect(() => validateTableSelection(["nope"], available)).toThrow()
    expect(() =>
      validateTableSelection(['x"; DROP TABLE y; --'], available)
    ).toThrow()
    expect(() =>
      validateTableSelection(["role", "nope"], available)
    ).toThrow() // whole request fails
  })
  it("accepts a subset of available names", () => {
    expect(() =>
      validateTableSelection(["role"], ["role", "user"])
    ).not.toThrow()
  })

  it("discovers views that depend on other views, not only on base tables", async () => {
    execute.mockReset()
    // table → view_a → view_b: the database answers with both levels
    execute.mockResolvedValue([
      { view_name: "view_a" },
      { view_name: "view_b" },
    ])
    const views = await listDependentViews(["task_assignment"])
    expect(views).toEqual(["view_a", "view_b"])
    const query = execute.mock.calls[0]?.[0]
    const { sql: text } = new PgDialect().sqlToQuery(query)
    expect(text).toContain("WITH RECURSIVE")
    expect(text).toMatch(/WITH RECURSIVE\s+(\w+)[\s\S]*?\bFROM\s+\1\b/)
  })
})
