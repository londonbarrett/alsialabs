export function computeLineTotal(
  qty: number,
  price: number,
  discountPct: number,
  taxPct: number
): {
  total: number
  discountAmount: number
  taxAmount: number
} {
  const lineSubtotal = qty * price
  const discountAmount = lineSubtotal * (discountPct / 100)
  const taxable = lineSubtotal - discountAmount
  const taxAmount = taxable * (taxPct / 100)
  const total = taxable + taxAmount
  return { total, discountAmount, taxAmount }
}

export interface InvoiceLineTotalsInput {
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
}

export function computeInvoiceTotals(items: InvoiceLineTotalsInput[]) {
  let subtotal = 0
  let discountTotal = 0
  let taxTotal = 0
  let grandTotal = 0

  for (const item of items) {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const discPct = parseFloat(item.discountPercent) || 0
    const taxPct = parseFloat(item.taxPercent) || 0

    const lineSubtotal = qty * price
    const discountAmount = lineSubtotal * (discPct / 100)
    const taxable = lineSubtotal - discountAmount
    const taxAmount = taxable * (taxPct / 100)

    subtotal += lineSubtotal
    discountTotal += discountAmount
    taxTotal += taxAmount
    grandTotal += taxable + taxAmount
  }

  return {
    subtotal: subtotal.toFixed(2),
    discountTotal: discountTotal.toFixed(2),
    taxTotal: taxTotal.toFixed(2),
    grandTotal: grandTotal.toFixed(2),
  }
}
