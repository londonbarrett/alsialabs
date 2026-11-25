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

/**
 * IANA zones for every project country, primary (capital / most populous)
 * zone first. Identifiers are the canonical names accepted by
 * `Intl.supportedValuesOf("timeZone")` in Node 26.
 */
export const COUNTRY_TIMEZONES: Record<ProjectCountry, string[]> = {
  CA: [
    "America/Toronto",
    "America/Vancouver",
    "America/Edmonton",
    "America/Winnipeg",
    "America/Halifax",
    "America/St_Johns",
    "America/Regina",
    "America/Moncton",
    "America/Whitehorse",
    "America/Iqaluit",
  ],
  US: [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Detroit",
    "America/Indianapolis",
  ],
  MX: [
    "America/Mexico_City",
    "America/Tijuana",
    "America/Hermosillo",
    "America/Mazatlan",
    "America/Monterrey",
    "America/Chihuahua",
    "America/Cancun",
    "America/Merida",
  ],
  GT: ["America/Guatemala"],
  BZ: ["America/Belize"],
  HN: ["America/Tegucigalpa"],
  SV: ["America/El_Salvador"],
  NI: ["America/Managua"],
  CR: ["America/Costa_Rica"],
  PA: ["America/Panama"],
  BS: ["America/Nassau"],
  CU: ["America/Havana"],
  HT: ["America/Port-au-Prince"],
  DO: ["America/Santo_Domingo"],
  JM: ["America/Jamaica"],
  PR: ["America/Puerto_Rico"],
  BB: ["America/Barbados"],
  TT: ["America/Port_of_Spain"],
  CO: ["America/Bogota"],
  VE: ["America/Caracas"],
  GY: ["America/Guyana"],
  SR: ["America/Paramaribo"],
  EC: ["America/Guayaquil", "Pacific/Galapagos"],
  PE: ["America/Lima"],
  BR: [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Cuiaba",
    "America/Recife",
    "America/Fortaleza",
    "America/Bahia",
    "America/Belem",
    "America/Boa_Vista",
    "America/Porto_Velho",
    "America/Rio_Branco",
    "America/Araguaina",
    "America/Maceio",
    "America/Santarem",
  ],
  BO: ["America/La_Paz"],
  PY: ["America/Asuncion"],
  CL: ["America/Santiago", "Pacific/Easter"],
  AR: [
    "America/Buenos_Aires",
    "America/Cordoba",
    "America/Mendoza",
    "America/Argentina/Tucuman",
    "America/Argentina/La_Rioja",
    "America/Argentina/Salta",
    "America/Argentina/San_Juan",
    "America/Argentina/San_Luis",
    "America/Argentina/Ushuaia",
    "America/Argentina/Rio_Gallegos",
  ],
  UY: ["America/Montevideo"],
}

const supportedTimeZones = new Set(Intl.supportedValuesOf("timeZone"))

/** Tolerates bad seed data so a stale country cannot crash a render. */
export function defaultTimeZoneForCountry(country: ProjectCountry): string {
  return COUNTRY_TIMEZONES[country]?.[0] ?? "UTC"
}

/** Whether the value is an IANA zone this runtime recognizes. */
export function isSupportedTimeZone(value: string): boolean {
  // ICU does not enumerate UTC in supportedValuesOf, but Intl accepts it and
  // it is the fallback returned for a stale country; keep the round-trip valid.
  return value === "UTC" || supportedTimeZones.has(value)
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
