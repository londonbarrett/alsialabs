import { describe, expect, it } from "vitest"

import {
  validateRepeatingWindow,
  validateTaskDetails,
  validateTaskName,
  validateTaskWindow,
} from "./form-validation"

const base = {
  name: "Plan the launch",
  startDate: "2026-11-10",
  startTime: "09:00",
  endDate: "2026-11-10",
  endTime: "11:00",
}

describe("validateTaskName", () => {
  it("rejects a blank name and accepts anything else", () => {
    expect(validateTaskName("  ")).toEqual(["NAME_REQUIRED"])
    expect(validateTaskName("Plan")).toEqual([])
  })
})

describe("validateTaskWindow", () => {
  it("ignores the name entirely", () => {
    const issues = validateTaskWindow(
      {
        startDate: "2026-11-10",
        startTime: "09:00",
        endDate: "2026-11-10",
        endTime: "11:00",
      },
      { requireWindow: false }
    )

    expect(issues).toEqual([])
  })
})

describe("validateRepeatingWindow", () => {
  it("accepts a start date with no end date (open-ended)", () => {
    expect(
      validateRepeatingWindow({ startDate: "2026-11-10", endDate: "" })
    ).toEqual([])
  })

  it("requires a start date", () => {
    expect(
      validateRepeatingWindow({ startDate: "", endDate: "" })
    ).toContain("START_DATE_REQUIRED")
  })

  it("accepts an end date after the start date", () => {
    expect(
      validateRepeatingWindow({
        startDate: "2026-11-10",
        endDate: "2026-12-24",
      })
    ).toEqual([])
  })

  it("rejects an end date before the start date", () => {
    expect(
      validateRepeatingWindow({
        startDate: "2026-11-10",
        endDate: "2026-11-09",
      })
    ).toContain("END_BEFORE_START")
  })
})

describe("validateTaskDetails", () => {
  it("accepts a complete same-day window", () => {
    expect(validateTaskDetails(base, { requireWindow: false })).toEqual([])
  })

  it("requires a non-blank name", () => {
    const issues = validateTaskDetails(
      { ...base, name: "   " },
      { requireWindow: false }
    )

    expect(issues).toContain("NAME_REQUIRED")
  })

  it("defers an untouched window when the window is not required yet", () => {
    const issues = validateTaskDetails(
      { name: "Plan", startDate: "", startTime: "", endDate: "", endTime: "" },
      { requireWindow: false }
    )

    expect(issues).toEqual([])
  })

  it("requires both dates when the window is required", () => {
    const issues = validateTaskDetails(
      { name: "Plan", startDate: "", startTime: "", endDate: "", endTime: "" },
      { requireWindow: true }
    )

    expect(issues).toEqual(["START_DATE_REQUIRED", "END_DATE_REQUIRED"])
  })

  it("blocks a half-entered window", () => {
    const issues = validateTaskDetails(
      { ...base, endDate: "", endTime: "" },
      { requireWindow: false }
    )

    expect(issues).toContain("END_DATE_REQUIRED")
  })

  it("blocks an end before the start", () => {
    const issues = validateTaskDetails(
      { ...base, endDate: "2026-11-10", endTime: "08:00" },
      { requireWindow: false }
    )

    expect(issues).toContain("END_BEFORE_START")
  })

  it("blocks a window crossing midnight", () => {
    const issues = validateTaskDetails(
      { ...base, endDate: "2026-11-11", endTime: "01:00" },
      { requireWindow: false }
    )

    expect(issues).toContain("SAME_DAY_REQUIRED")
  })
})
