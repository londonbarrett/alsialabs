"use client"

import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export interface PaymentFormValues {
  amount: string
  paymentDate: string
  method: string
  reference: string
  notes: string
}

export interface PaymentSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface PaymentFormProps {
  initialValues: PaymentFormValues
  onSubmit: (values: PaymentFormValues) => Promise<PaymentSubmitResult>
  submitLabel: string
  onCancel: () => void
}

export function PaymentForm({
  initialValues,
  onSubmit,
  submitLabel,
  onCancel,
}: PaymentFormProps) {
  const t = useTranslations()
  const [amount, setAmount] = useState(initialValues.amount)
  const [paymentDate, setPaymentDate] = useState(
    initialValues.paymentDate
  )
  const [method, setMethod] = useState(initialValues.method)
  const [reference, setReference] = useState(initialValues.reference)
  const [notes, setNotes] = useState(initialValues.notes)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t("common.somethingWentWrong"))
      return
    }

    await onSubmit({
      amount,
      paymentDate,
      method,
      reference,
      notes,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">{t("sales.amount")}</Label>
        <MoneyInput
          id="amount"
          value={amount}
          onChange={setAmount}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="paymentDate">{t("sales.paymentDate")}</Label>
        <Input
          id="paymentDate"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="method">{t("sales.paymentMethod")}</Label>
        <Input
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          placeholder={t("sales.paymentMethodPlaceholder")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reference">{t("sales.reference")}</Label>
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("sales.referencePlaceholder")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{t("sales.notes")}</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("sales.cancel")}
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  )
}
