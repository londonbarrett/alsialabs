"use client"

import { recordPayment } from "@/lib/actions/sales"
import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/common/money-input"
import { Spinner } from "@/components/ui/spinner"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface RecordPaymentFormProps {
  invoiceId: string
  remainingBalance: string
  onSuccess: () => void
  onCancel: () => void
}

export function RecordPaymentForm({
  invoiceId,
  remainingBalance,
  onSuccess,
  onCancel,
}: RecordPaymentFormProps) {
  const t = useTranslations()
  const [amount, setAmount] = useState(remainingBalance)
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t("common.somethingWentWrong"))
      return
    }

    setSaving(true)
    try {
      const result = await recordPayment(invoiceId, {
        amount,
        paymentDate,
        method,
        reference,
        notes,
      })
      if (result.success) {
        toast.success(t("sales.paymentRecorded"))
        onSuccess()
      } else {
        toast.error(result.error || t("common.somethingWentWrong"))
      }
    } catch {
      toast.error(t("common.somethingWentWrong"))
    }
    setSaving(false)
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
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t("sales.cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {t("sales.recordPayment")}
        </Button>
      </DialogFooter>
    </form>
  )
}
