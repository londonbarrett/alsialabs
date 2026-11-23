import { describe, expect, it } from "vitest"

import {
  currencyFractionDigits,
  formatMoney,
  normalizeMoneyInput,
  parseMoney,
} from "./money"

describe("currencyFractionDigits", () => {
  it("uses two digits for USD and EUR", () => {
    expect(currencyFractionDigits("USD")).toBe(2)
    expect(currencyFractionDigits("EUR", "de-DE")).toBe(2)
  })

  it("uses zero digits for COP in Colombia", () => {
    expect(currencyFractionDigits("COP", "es-CO")).toBe(0)
  })
})

describe("parseMoney", () => {
  it("parses en-US formatted input into a canonical decimal string", () => {
    expect(parseMoney("$1,500.50")).toBe("1500.50")
  })

  it("parses es-ES formatted input using the locale separators", () => {
    expect(parseMoney("1.500,50", { locale: "es-ES", currency: "EUR" })).toBe(
      "1500.50"
    )
  })

  it("treats the group separator as grouping regardless of digit count", () => {
    // A backspace/deletion in "$1,500" leaves "$1,50" or "$1,00"; the comma is
    // still grouping, so these are 150 and 100, not 1.50 and 1.00.
    expect(parseMoney("$1,50")).toBe("150")
    expect(parseMoney("$1,00")).toBe("100")
    expect(parseMoney("$15,0")).toBe("150")
  })

  it("preserves a trailing decimal separator while typing", () => {
    expect(parseMoney("150.")).toBe("150.")
  })

  it("caps decimals to the currency's digit count", () => {
    expect(parseMoney("150.5")).toBe("150.5")
    // "." is the en-US decimal separator, so an over-long fraction is capped,
    // never reinterpreted as grouping.
    expect(parseMoney("12.345")).toBe("12.34")
    expect(parseMoney("150.001")).toBe("150.00")
  })

  it("drops decimals for a zero-digit currency", () => {
    // es-CO uses "." for grouping and "," for decimals.
    expect(parseMoney("150,5", { currency: "COP", locale: "es-CO" })).toBe(
      "150"
    )
    expect(parseMoney("150.5", { currency: "COP", locale: "es-CO" })).toBe(
      "1505"
    )
  })

  it("rejects empty, negative and non-numeric input", () => {
    expect(parseMoney("")).toBe("")
    expect(parseMoney("-5")).toBe("")
    expect(parseMoney("abc")).toBe("")
  })
})

describe("normalizeMoneyInput", () => {
  it("strips a group separator left mid-edit with extra digits", () => {
    expect(normalizeMoneyInput("$1,5200")).toBe("15200")
  })

  it("strips a group separator left mid-edit with too few digits", () => {
    expect(normalizeMoneyInput("$1,50")).toBe("150")
    expect(normalizeMoneyInput("$15,0")).toBe("150")
  })

  it("truncates cents padding before parsing", () => {
    expect(normalizeMoneyInput("$150.500")).toBe("150.50")
  })

  it("preserves a trailing decimal separator while typing", () => {
    expect(normalizeMoneyInput("$150.")).toBe("150.")
  })

  it("drops an invisible zero-only fraction from the emitted value", () => {
    expect(normalizeMoneyInput("$150.00")).toBe("150")
    expect(normalizeMoneyInput("15.0")).toBe("15")
    expect(normalizeMoneyInput("150.50")).toBe("150.50")
  })

  it("uses the locale separators and drops decimals for zero-digit currencies", () => {
    expect(
      normalizeMoneyInput("1.500,50", { locale: "es-CO", currency: "EUR" })
    ).toBe("1500.50")
    expect(
      normalizeMoneyInput("$150,50", { locale: "es-CO", currency: "COP" })
    ).toBe("150")
  })

  it("returns an empty string for invalid input", () => {
    expect(normalizeMoneyInput("abc")).toBe("")
  })
})

describe("formatMoney", () => {
  it("hides cents for whole USD amounts", () => {
    expect(formatMoney("150")).toBe("$150")
    expect(formatMoney("150.00")).toBe("$150")
  })

  it("shows both cents when a fractional USD amount is present", () => {
    expect(formatMoney("150.5")).toBe("$150.50")
  })

  it("does not inflate an over-precise number into a larger whole amount", () => {
    const formatted = formatMoney(150.001)
    expect(formatted).not.toContain("150,001")
    expect(formatted).toBe("$150")
  })

  it("renders negative values with a minus sign and the magnitude", () => {
    const formatted = formatMoney(-5)
    expect(formatted).toContain("-")
    expect(formatted).toContain("5")
    expect(formatted).toBe("-$5")
  })

  it("uses the requested currency, locale and zero fraction digits for COP", () => {
    const formatted = formatMoney("1500,5", {
      currency: "COP",
      locale: "es-CO",
    })
    expect(formatted).toContain("1.500")
    expect(formatted).not.toMatch(/,\d/)
  })

  it("formats a canonical value independently of the display locale", () => {
    // A US project's stored "1500.00" stays 1500 when shown with COP/es-CO:
    // "." is the group separator there, so locale parsing would yield 150000.
    const cop = formatMoney("1500.00", { currency: "COP", locale: "es-CO" })
    expect(cop).toContain("1.500")
    expect(cop).not.toContain("150.000")
    expect(formatMoney("1500.00", { currency: "USD", locale: "en-US" })).toBe(
      "$1,500"
    )
  })

  it("returns an empty string for invalid input", () => {
    expect(formatMoney("abc")).toBe("")
  })
})
