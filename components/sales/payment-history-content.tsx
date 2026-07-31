"use client"

import { Spinner } from "@/components/ui/spinner"
import { getInvoicePayments } from "@/lib/actions/sales"
import type { InvoicePayment } from "@/lib/drizzle/schema"
import { useEffect, useState } from "react"

export function PaymentHistoryContent({
  invoiceId,
}: {
  invoiceId: string
}) {
  const [payments, setPayments] = useState<InvoicePayment[] | null>(
    null
  )

  useEffect(() => {
    getInvoicePayments(invoiceId)
      .then(setPayments)
      .catch(() => setPayments([]))
  }, [invoiceId])

  if (payments === null) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No payments recorded yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between rounded-md border p-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-sm font-medium">
              $
              {parseFloat(payment.amount).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {payment.paymentDate}
              {payment.method ? ` · ${payment.method}` : ""}
              {payment.reference ? ` · ${payment.reference}` : ""}
            </span>
            {payment.notes && (
              <span className="text-xs text-muted-foreground">
                {payment.notes}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
