// lib/drizzle/ssl.test.ts
import { describe, expect, it } from "vitest"
import { resolveSslOption } from "./ssl"

describe("resolveSslOption", () => {
  it("keeps the legacy default when unset or empty", () => {
    expect(resolveSslOption(undefined)).toBe("require")
    expect(resolveSslOption("")).toBe("require")
  })
  it("disables ssl only for explicit disable", () => {
    expect(resolveSslOption("disable")).toBe(false)
  })
  it("passes prefer through", () => {
    expect(resolveSslOption("prefer")).toBe("prefer")
  })
  it("falls back to require for unknown values", () => {
    expect(resolveSslOption("bogus")).toBe("require")
  })
})
