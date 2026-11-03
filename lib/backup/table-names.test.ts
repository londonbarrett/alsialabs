import { describe, expect, it } from "vitest"

import { filterAvailableTableNames } from "./table-names"

describe("lib/backup/table-names", () => {
  it("filterAvailableTableNames drops stale names and returns null when nothing valid remains", () => {
    expect(
      filterAvailableTableNames(["role", "ghost"], ["role", "user"])
    ).toEqual(["role"])
    expect(
      filterAvailableTableNames(["ghost"], ["role", "user"])
    ).toBeNull()
    expect(filterAvailableTableNames(null, ["role"])).toBeNull()
  })
})
