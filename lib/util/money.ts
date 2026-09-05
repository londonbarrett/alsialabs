const defaultFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatMoney(
  value: string,
  options?: { currency?: string; locale?: string }
): string {
  const numericString = value.replace(/[^0-9]/g, '')
  const num = parseInt(numericString, 10)
  if (Number.isNaN(num)) return ''

  const { currency = 'USD', locale = 'en-US' } = options || {}

  if (currency === 'USD' && locale === 'en-US') {
    return defaultFormatter.format(num)
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

export function parseMoney(value: string): string {
  return value.replace(/[^0-9]/g, '')
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
