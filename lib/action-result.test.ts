import { describe, it, expect, vi } from "vitest"
import {
  ActionError,
  ActionValidationError,
  isActionError,
  isActionValidationError,
  runAction,
  throwActionError,
  throwActionValidationError,
} from "./action-result"

describe("runAction", () => {
  it("wraps a resolved value as data", async () => {
    const result = await runAction(async () => ({ id: "1" }))
    expect(result).toEqual({ data: { id: "1" } })
  })

  it("maps a thrown ActionError to serverError with its code", async () => {
    const result = await runAction(async () => {
      throwActionError("FORBIDDEN")
    })
    expect(result).toEqual({ serverError: { code: "FORBIDDEN" } })
  })

  it("maps a thrown ActionValidationError to validationErrors", async () => {
    const result = await runAction(async () => {
      throwActionValidationError({ name: ["required"] })
    })
    expect(result).toEqual({
      validationErrors: { name: ["required"] },
    })
  })

  it("maps an unexpected throw to INTERNAL_SERVER_ERROR", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await runAction(async () => {
      throw new Error("boom")
    })
    expect(result).toEqual({
      serverError: { code: "INTERNAL_SERVER_ERROR" },
    })
    spy.mockRestore()
  })
})

describe("ActionError guards", () => {
  it("recognises ActionError instances", () => {
    expect(isActionError(new ActionError("NOT_FOUND"))).toBe(true)
    expect(isActionError(new Error("x"))).toBe(false)
  })

  it("recognises ActionValidationError instances", () => {
    expect(
      isActionValidationError(new ActionValidationError({ name: ["x"] }))
    ).toBe(true)
    expect(isActionValidationError(new ActionError("NOT_FOUND"))).toBe(
      false
    )
  })
})
