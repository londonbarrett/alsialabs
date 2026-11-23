import { describe, expect, it } from "vitest"

import {
  COUNTRY_FORMAT,
  PROJECT_COUNTRIES,
  countryFlag,
  countryLabel,
  countryOptionLabel,
  currencyDisplayLabel,
  currencyForCountry,
  currencyLabel,
  localeForCountry,
  projectMoneyProps,
  sortedProjectCountries,
  type ProjectCountry,
} from "./location"

const invalidCountry = "ZZ" as ProjectCountry
const invalidLocale = "not a valid locale"

describe("PROJECT_COUNTRIES", () => {
  it("includes countries spanning North/Central America, the Caribbean and South America", () => {
    const expected = [
      "CA",
      "US",
      "MX",
      "GT",
      "PA",
      "BS",
      "DO",
      "CO",
      "BR",
      "AR",
      "CL",
    ] as const

    for (const country of expected) {
      expect(PROJECT_COUNTRIES, `missing ${country}`).toContain(country)
    }
  })

  it("orders the list north to south, with the Caribbean before South America", () => {
    const position = (country: ProjectCountry) =>
      PROJECT_COUNTRIES.indexOf(country)

    expect(position("CA")).toBeLessThan(position("US"))
    expect(position("US")).toBeLessThan(position("MX"))
    expect(position("MX")).toBeLessThan(position("GT"))
    expect(position("GT")).toBeLessThan(position("PA"))
    expect(position("PA")).toBeLessThan(position("BS"))
    expect(position("BS")).toBeLessThan(position("DO"))
    expect(position("DO")).toBeLessThan(position("CO"))
    expect(position("CO")).toBeLessThan(position("VE"))
    expect(position("VE")).toBeLessThan(position("BR"))
    expect(position("BR")).toBeLessThan(position("BO"))
    expect(position("BO")).toBeLessThan(position("CL"))
    expect(position("CL")).toBeLessThan(position("AR"))
    expect(position("AR")).toBeLessThan(position("UY"))
  })

  it("has a currency and locale for every country in the list", () => {
    for (const country of PROJECT_COUNTRIES) {
      const format = COUNTRY_FORMAT[country]

      expect(format, `no format for ${country}`).toBeDefined()
      expect(format?.currency).toMatch(/^[A-Z]{3}$/)
      expect(format?.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
    }
  })
})

describe("projectMoneyProps", () => {
  it("returns the stored currency and locale for Colombia", () => {
    expect(projectMoneyProps("CO")).toEqual({
      currency: "COP",
      locale: "es-CO",
    })
  })

  it("returns the stored currency and locale for the United States", () => {
    expect(projectMoneyProps("US")).toEqual({
      currency: "USD",
      locale: "en-US",
    })
  })

  it("exposes the same pair through the individual helpers", () => {
    expect(currencyForCountry("BR")).toBe("BRL")
    expect(localeForCountry("BR")).toBe("pt-BR")
  })

  it("falls back to USD/en-US for unexpected country values", () => {
    expect(currencyForCountry(invalidCountry)).toBe("USD")
    expect(localeForCountry(invalidCountry)).toBe("en-US")
    expect(projectMoneyProps(invalidCountry)).toEqual({
      currency: "USD",
      locale: "en-US",
    })
  })
})

describe("display labels", () => {
  it("localizes country names with Intl.DisplayNames", () => {
    expect(countryLabel("CO", "es")).toBe("Colombia")
    expect(countryLabel("US", "es")).toBe("Estados Unidos")
  })

  it("localizes currency names with Intl.DisplayNames", () => {
    expect(currencyLabel("COP", "es")).toBe("peso colombiano")
    expect(currencyLabel("USD", "en")).toBe("US Dollar")
  })

  it("falls back to the code when the locale cannot be formatted", () => {
    expect(countryLabel("CO", invalidLocale)).toBe("CO")
    expect(currencyLabel("COP", invalidLocale)).toBe("COP")
  })
})

describe("country selector options", () => {
  it("builds a regional-indicator flag from the country code", () => {
    expect(countryFlag("US")).toBe("🇺🇸")
    expect(countryFlag("CO")).toBe("🇨🇴")
    expect(countryFlag(invalidCountry)).toBe("🏳️")
  })

  it("sorts countries alphabetically by localized name", () => {
    const sorted = sortedProjectCountries("en")
    expect(sorted).toHaveLength(PROJECT_COUNTRIES.length)
    expect(sorted).toEqual(expect.arrayContaining([...PROJECT_COUNTRIES]))
    const labels = sorted.map((code) => countryLabel(code, "en"))
    expect([...labels].sort((a, b) => a.localeCompare(b, "en"))).toEqual(
      labels
    )
  })

  it("formats a read-only currency label as code plus localized name", () => {
    expect(currencyDisplayLabel("USD", "en")).toBe("USD — US Dollar")
    expect(currencyDisplayLabel("COP", "es")).toBe("COP — peso colombiano")
  })

  it("formats an option as flag country - currency", () => {
    expect(countryOptionLabel("US", "en")).toBe("🇺🇸 United States - USD")
    expect(countryOptionLabel("CO", "es")).toBe("🇨🇴 Colombia - COP")
  })
})
