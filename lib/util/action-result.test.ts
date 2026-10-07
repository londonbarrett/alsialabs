import { describe, it, expect } from "vitest"
import { defaultIsSuccess } from "./action-result"

describe("defaultIsSuccess", () => {
  it("treats a safe-action value result as success", () => {
    expect(defaultIsSuccess({ data: { id: "1" } })).toBe(true)
  })

  it("treats a void safe-action result (empty object) as success", () => {
    expect(defaultIsSuccess({})).toBe(true)
  })

  it("treats a missing result as success", () => {
    expect(defaultIsSuccess(undefined)).toBe(true)
    expect(defaultIsSuccess(null)).toBe(true)
  })

  it("treats a server error as failure", () => {
    expect(defaultIsSuccess({ serverError: { code: "BOOM" } })).toBe(
      false
    )
  })

  it("treats validation errors as failure", () => {
    expect(
      defaultIsSuccess({ validationErrors: { name: ["required"] } })
    ).toBe(false)
  })

  it("honours the store-action success envelope", () => {
    expect(defaultIsSuccess({ success: true })).toBe(true)
    expect(
      defaultIsSuccess({ success: false, error: "nope" })
    ).toBe(false)
  })
})
