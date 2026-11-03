import { describe, expect, it } from "vitest"

import { validateTableSelection } from "./tables"

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
})
