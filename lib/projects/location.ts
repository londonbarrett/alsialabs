/**
 * Countries of the Americas, ordered north to south: North/Central America,
 * the Caribbean, then South America. Stored as ISO 3166-1 alpha-2 codes.
 */
export const PROJECT_COUNTRIES = [
  "CA",
  "US",
  "MX",
  "GT",
  "BZ",
  "HN",
  "SV",
  "NI",
  "CR",
  "PA",
  "BS",
  "CU",
  "HT",
  "DO",
  "JM",
  "PR",
  "BB",
  "TT",
  "CO",
  "VE",
  "GY",
  "SR",
  "EC",
  "PE",
  "BR",
  "BO",
  "PY",
  "CL",
  "AR",
  "UY",
] as const

export type ProjectCountry = (typeof PROJECT_COUNTRIES)[number]

type CountryFormat = { currency: string; locale: string }

/** Currency (ISO 4217) and number-format locale for every project country. */
export const COUNTRY_FORMAT: Record<ProjectCountry, CountryFormat> = {
  CA: { currency: "CAD", locale: "en-CA" },
  US: { currency: "USD", locale: "en-US" },
  MX: { currency: "MXN", locale: "es-MX" },
  GT: { currency: "GTQ", locale: "es-GT" },
  BZ: { currency: "BZD", locale: "en-BZ" },
  HN: { currency: "HNL", locale: "es-HN" },
  SV: { currency: "USD", locale: "es-SV" },
  NI: { currency: "NIO", locale: "es-NI" },
  CR: { currency: "CRC", locale: "es-CR" },
  PA: { currency: "PAB", locale: "es-PA" },
  BS: { currency: "BSD", locale: "en-BS" },
  CU: { currency: "CUP", locale: "es-CU" },
  HT: { currency: "HTG", locale: "ht-HT" },
  DO: { currency: "DOP", locale: "es-DO" },
  JM: { currency: "JMD", locale: "en-JM" },
  PR: { currency: "USD", locale: "es-PR" },
  BB: { currency: "BBD", locale: "en-BB" },
  TT: { currency: "TTD", locale: "en-TT" },
  CO: { currency: "COP", locale: "es-CO" },
  VE: { currency: "VES", locale: "es-VE" },
  GY: { currency: "GYD", locale: "en-GY" },
  SR: { currency: "SRD", locale: "nl-SR" },
  EC: { currency: "USD", locale: "es-EC" },
  PE: { currency: "PEN", locale: "es-PE" },
  BR: { currency: "BRL", locale: "pt-BR" },
  BO: { currency: "BOB", locale: "es-BO" },
  PY: { currency: "PYG", locale: "es-PY" },
  CL: { currency: "CLP", locale: "es-CL" },
  AR: { currency: "ARS", locale: "es-AR" },
  UY: { currency: "UYU", locale: "es-UY" },
}

/** Tolerates bad seed data so a stale country cannot crash a render. */
export function currencyForCountry(country: ProjectCountry): string {
  return COUNTRY_FORMAT[country]?.currency ?? "USD"
}

/** Tolerates bad seed data so a stale country cannot crash a render. */
export function localeForCountry(country: ProjectCountry): string {
  return COUNTRY_FORMAT[country]?.locale ?? "en-US"
}

/** Spread into `Money`/`MoneyInput` so all project money surfaces agree. */
export function projectMoneyProps(country: ProjectCountry): CountryFormat {
  return {
    currency: currencyForCountry(country),
    locale: localeForCountry(country),
  }
}

const displayNamesCache = new Map<string, Intl.DisplayNames>()

function getDisplayNames(
  locale: string,
  type: "region" | "currency"
): Intl.DisplayNames {
  const key = `${locale}|${type}`
  let names = displayNamesCache.get(key)
  if (!names) {
    names = new Intl.DisplayNames(locale, { type })
    displayNamesCache.set(key, names)
  }
  return names
}

export function countryLabel(country: ProjectCountry, locale: string): string {
  try {
    return getDisplayNames(locale, "region").of(country) ?? country
  } catch {
    return country
  }
}

export function currencyLabel(currency: string, locale: string): string {
  try {
    return getDisplayNames(locale, "currency").of(currency) ?? currency
  } catch {
    return currency
  }
}

/** Read-only currency label: ISO code plus its localized name. */
export function currencyDisplayLabel(
  currency: string,
  locale: string
): string {
  return `${currency} — ${currencyLabel(currency, locale)}`
}

/** Regional-indicator flag emoji for an ISO 3166-1 alpha-2 country code. */
export function countryFlag(country: ProjectCountry): string {
  const code = country.toUpperCase()
  if (!(code in COUNTRY_FORMAT)) return "🏳️"
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

/** Countries ordered alphabetically by their localized name. */
export function sortedProjectCountries(locale: string): ProjectCountry[] {
  return [...PROJECT_COUNTRIES].sort((a, b) =>
    countryLabel(a, locale).localeCompare(countryLabel(b, locale), locale)
  )
}

/** Select option label: `FLAG Country - currency`. */
export function countryOptionLabel(
  country: ProjectCountry,
  locale: string
): string {
  return `${countryFlag(country)} ${countryLabel(country, locale)} - ${currencyForCountry(country)}`
}
