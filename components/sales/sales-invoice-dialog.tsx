"use client"

import { Dialog } from "@/components/common/dialog"
import { InvoiceForm } from "@/components/sales/invoice-form"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import { useOptimisticAction } from "@/hooks/use-optimistic-store"
import { createInvoice, updateInvoice } from "@/lib/actions/invoices"
import type { Invoice } from "@/lib/drizzle/schema"
import type { InvoiceFormData } from "@/lib/schemas/invoice"
import { useActionError } from "@/lib/util/action-errors"
import { buildOptimisticInvoice } from "@/lib/util/invoices"
import {
  useInvoiceStore,
  type InvoiceAction,
} from "@/stores/invoice-store"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface SalesInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingInvoice?: Invoice
}

export function SalesInvoiceDialog({
  open,
  onOpenChange,
  editingInvoice,
}: SalesInvoiceDialogProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const { run } = useOptimisticAction(useInvoiceStore)

  async function handleSubmit(
    data: InvoiceFormData,
    invoiceId?: string
  ) {
    const isEdit = !!invoiceId
    const invoices = useInvoiceStore.getState().committed
    const optimisticInvoice = buildOptimisticInvoice(
      data,
      invoiceId,
      editingInvoice,
      invoices
    )
    const action: InvoiceAction = isEdit
      ? { type: "update", invoice: optimisticInvoice }
      : { type: "add", invoice: optimisticInvoice }

    onOpenChange(false)
    const result = await run(
      action,
      () =>
        isEdit
          ? updateInvoice({ ...data, invoiceId: invoiceId! })
          : createInvoice(data),
      {
        commitAction: (res): InvoiceAction => {
          const real = (res as { data?: unknown })
            .data as unknown as InvoiceWithClientName
          const realWithClient: InvoiceWithClientName = {
            ...real,
            clientName: optimisticInvoice.clientName,
          }
          return isEdit
            ? { type: "update", invoice: realWithClient }
            : {
                type: "replaceTemp",
                tempId: optimisticInvoice.id,
                invoice: realWithClient,
              }
        },
      }
    )

    if (result?.data) {
      toast.success(
        isEdit ? t("sales.invoiceUpdated") : t("sales.invoiceCreated")
      )
      return { success: true as const, data: result.data }
    }

    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      return {
        success: false as const,
        error: translateError(result.serverError.code),
      }
    }
    if (result?.validationErrors) {
      // Re-open so the form can show field errors
      onOpenChange(true)
      return {
        success: false as const,
        error: t("common.somethingWentWrong"),
        fieldErrors: result.validationErrors as Record<
          string,
          string[] | undefined
        >,
      }
    }
    toast.error(t("common.somethingWentWrong"))
    return {
      success: false as const,
      error: t("common.somethingWentWrong"),
    }
  }

  return (
    <Dialog
      title={
        editingInvoice ? t("sales.editInvoice") : t("sales.newInvoice")
      }
      description={
        editingInvoice
          ? t("sales.updateDetails")
          : t("sales.fillDetails")
      }
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-4xl"
    >
      <InvoiceForm
        key={editingInvoice?.id ?? "new"}
        invoice={editingInvoice}
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
