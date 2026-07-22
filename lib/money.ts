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
