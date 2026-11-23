const MAX_FRACTION_DIGITS = 2

// CLDR documents COP as a zero-minor-unit currency, but recent ICU releases
// (77+) report two digits for it. Keep the documented value explicit so the
// behavior does not drift with the runtime's ICU data.
const ZERO_FRACTION_CURRENCIES = new Set(["COP"])

const fractionDigitsCache = new Map<string, number>()
const formatterCache = new Map<string, Intl.NumberFormat>()
const separatorsCache = new Map<string, { group: string; decimal: string }>()

function getFormatter(
  locale: string,
  currency: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${minimumFractionDigits}|${maximumFractionDigits}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    })
    formatterCache.set(key, formatter)
  }
  return formatter
}

export function currencyFractionDigits(
  currency: string,
  locale = "en-US"
): number {
  const key = `${locale}|${currency}`
  const cached = fractionDigitsCache.get(key)
  if (cached !== undefined) return cached

  const resolved =
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? MAX_FRACTION_DIGITS
  const digits = ZERO_FRACTION_CURRENCIES.has(currency)
    ? 0
    : Math.min(resolved, MAX_FRACTION_DIGITS)
  fractionDigitsCache.set(key, digits)
  return digits
}

function getSeparators(
  locale: string
): { group: string; decimal: string } {
  const cached = separatorsCache.get(locale)
  if (cached) return cached

  // Force two fraction digits so the decimal separator is present even for
  // currencies that normally display none, and use a large enough sample that
  // a group separator is always present (es-ES does not group 1000.1).
  const parts = getFormatter(locale, "USD", 2, 2).formatToParts(1000000.1)
  const separators = {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  }
  separatorsCache.set(locale, separators)
  return separators
}

export function getDecimalSeparator(locale: string): string {
  return getSeparators(locale).decimal
}

/**
 * A canonical value like "150.00" displays as "$150", so submitting it would
 * carry a fractional part the user never saw. Drop a zero-only fraction while
 * leaving a bare trailing separator ("150.") intact — that one is visible in
 * the field and is what lets the next digit become cents.
 */
function stripInvisibleFraction(value: string): string {
  return value.replace(/\.0+$/, "")
}

/**
 * Parses a raw money-input value as the user types. Formatting artifacts are
 * removed before canonical parsing: the locale's group separator is grouping
 * everywhere (never a decimal, regardless of how many digits follow it), and
 * only the locale's decimal separator starts a fraction. Excess fraction
 * digits are truncated to the currency's digit count.
 */
export function normalizeMoneyInput(
  raw: string,
  options?: { currency?: string; locale?: string }
): string {
  const { currency = "USD", locale = "en-US" } = options ?? {}
  const maxDigits = currencyFractionDigits(currency, locale)
  const { group, decimal } = getSeparators(locale)

  let normalized = ""
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === group) continue
    normalized += raw[i]
  }

  const decimalIndex = normalized.lastIndexOf(decimal)
  if (decimalIndex !== -1) {
    let end = decimalIndex + 1
    let digits = 0
    while (end < normalized.length && /\d/.test(normalized[end])) {
      digits++
      if (digits > maxDigits) break
      end++
    }
    if (end < normalized.length) normalized = normalized.slice(0, end)
  }

  return stripInvisibleFraction(
    parseMoney(normalized, { currency, locale })
  )
}

export function formatMoney(
  value: string | number,
  options?: { currency?: string; locale?: string }
): string {
  const { currency = "USD", locale = "en-US" } = options ?? {}
  // parseMoney rejects negatives by design (it parses typed input), but a
  // stored/displayed value may be negative. Handle the sign here and parse the
  // magnitude so "-5" renders "-$5" instead of an empty string.
  const raw = String(value).trim()
  const isNegative = raw.startsWith("-")
  const unsigned = isNegative ? raw.slice(1) : raw
  // Stored and parsed values are canonical decimals ("1500.00") independent of
  // the display locale. parseMoney interprets separators using that locale,
  // where "." is a group separator in es-CO/es-MX, so it would inflate the
  // amount (1500.00 → 150000). Parse canonical values as en-US to keep the
  // fraction-capping behavior; only raw locale-formatted input uses `locale`.
  const canonical = parseMoney(unsigned, {
    currency,
    locale: /^\d+(?:\.\d*)?$/.test(unsigned) ? "en-US" : locale,
  })
  const numericString = canonical.endsWith(".")
    ? canonical.slice(0, -1)
    : canonical
  if (!numericString) return ""

  const num = Number(numericString)
  if (!Number.isFinite(num)) return ""

  const maximumFractionDigits = currencyFractionDigits(currency, locale)
  // A single formatter with minimumFractionDigits: 0 would render "$150.5".
  // Pad cents only for a non-zero numeric fraction: "150.00" is whole and must
  // render like "150" (stored two-decimal strings assert "$150" in E2E).
  const minimumFractionDigits = Number.isInteger(num) ? 0 : maximumFractionDigits

  return getFormatter(
    locale,
    currency,
    minimumFractionDigits,
    maximumFractionDigits
  ).format(isNegative ? -num : num)
}

export function parseMoney(
  value: string,
  options?: { locale?: string; currency?: string }
): string {
  const { locale = "en-US", currency = "USD" } = options ?? {}
  if (!value.trim() || value.includes("-")) return ""

  const symbol = getFormatter(locale, currency, 0, 0)
    .formatToParts(0)
    .filter((part) => part.type === "currency")
    .map((part) => part.value)
    .join("")
  const cleaned = value.trim().split(symbol).join("").replace(/\s/g, "")
  if (!cleaned) return ""

  const { group, decimal } = getSeparators(locale)
  const currencyDigits = currencyFractionDigits(currency, locale)

  // Only the locale's own separators are formatting artifacts. Rejecting every
  // other character keeps negative/non-numeric input out while accepting the
  // group separator used by locales whose separators differ from en-US.
  for (const char of cleaned) {
    if (!/\d/.test(char) && char !== group && char !== decimal) return ""
  }

  let integer = ""
  let fraction: string | null = null
  let fractionLimit = 0
  let sawFractionDigit = false

  for (let index = 0; index < cleaned.length; index++) {
    const char = cleaned[index]
    if (char >= "0" && char <= "9") {
      if (fraction === null) {
        integer += char
      } else {
        sawFractionDigit = true
        if (fraction.length < fractionLimit) fraction += char
      }
      continue
    }
    if (fraction !== null) continue
    // The group separator is grouping regardless of how many digits follow it;
    // only the decimal separator can start a fraction.
    if (char === group) continue

    fraction = ""
    fractionLimit = currencyDigits
  }

  if (!integer) return ""
  if (fraction === null) return integer
  // A trailing separator is useful while typing only when the currency can
  // actually accept cents after it.
  if (!sawFractionDigit) return currencyDigits > 0 ? `${integer}.` : integer
  return fraction.length > 0 ? `${integer}.${fraction}` : integer
}

export function formatQuantity(value: string): string {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return value
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(
  value: string | number,
  options?: { currency?: string; locale?: string }
): string {
  const numericValue =
    typeof value === 'string' ? parseFloat(value) : value

  if (Number.isNaN(numericValue)) return ''

  const { currency = 'USD', locale = 'en-US' } = options || {}

  if (currency === 'USD' && locale === 'en-US') {
    return currencyFormatter.format(numericValue)
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue)
}
