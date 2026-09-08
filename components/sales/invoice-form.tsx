"use client"

import { ClientCombobox } from "@/components/clients/client-combobox"
import { MoneyInput } from "@/components/common/money-input"
import {
  LineItemsTable,
  type LineItem,
  type LineItemErrors,
} from "@/components/sales/line-items-table"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { ClientOption } from "@/lib/actions/clients"
import {
  getInvoiceItems,
  getInvoiceProducts,
  type InvoiceFormData,
} from "@/lib/actions/sales"
import type { Invoice } from "@/lib/drizzle/schema"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

export interface InvoiceSubmitResult {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[] | undefined>
}

interface InvoiceFormProps {
  invoice?: Invoice & { clientName?: string | null }
  selectedClientId?: string
  onSubmit: (
    data: InvoiceFormData,
    invoiceId?: string
  ) => Promise<InvoiceSubmitResult>
  onCancel: () => void
}

let itemKeyCounter = 0
function nextKey() {
  return `item_${++itemKeyCounter}`
}

function createEmptyItem(
  type: string,
  product?: { id: string; name: string }
): LineItem {
  return {
    key: nextKey(),
    description: product ? product.name : "",
    quantity: "1",
    unitPrice: "0",
    discountPercent: "0",
    taxPercent: "0",
    productId: product ? product.id : null,
  }
}

export function InvoiceForm({
  invoice,
  selectedClientId,
  onSubmit,
  onCancel,
}: InvoiceFormProps) {
  const t = useTranslations()
  const [products, setProducts] = useState<
    Array<{ id: string; name: string }>
  >([])
  const [type, setType] = useState<"product" | "service">(
    (invoice?.type as "product" | "service") ?? "product"
  )
  const [client, setClient] = useState<ClientOption | null>(() => {
    if (invoice?.clientId) {
      return {
        id: invoice.clientId,
        name: invoice.clientName ?? "",
        phone: "",
      }
    }
    return null
  })
  const [issueDate, setIssueDate] = useState(
    invoice?.issueDate ?? new Date().toISOString().slice(0, 10)
  )
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "")
  const [paidAmount, setPaidAmount] = useState("0")

  const [items, setItems] = useState<LineItem[]>(() =>
    invoice?.id ? [] : [createEmptyItem("product")]
  )
  const loadingItems = invoice?.id != null && items.length === 0

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [itemErrors, setItemErrors] = useState<
    Record<string, LineItemErrors>
  >({})

  useEffect(() => {
    getInvoiceProducts()
      .catch(() => [])
      .then(setProducts)
  }, [])

  useEffect(() => {
    if (!invoice?.id) return
    getInvoiceItems(invoice.id)
      .then((data) => {
        setItems(
          data.map((item) => ({
            key: nextKey(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxPercent: item.taxPercent,
            productId: item.productId,
          }))
        )
      })
      .catch(() => toast.error(t("sales.failedToLoadItems")))
  }, [invoice?.id, t])

  function updateItem(
    key: string,
    field: keyof LineItem,
    value: string
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        return { ...item, [field]: value }
      })
    )
    // clear per-field error on change
    setItemErrors((prev) => {
      const cur = prev[key]
      if (!cur || !cur[field]) return prev
      const next = { ...prev }
      const copy = { ...cur }
      delete copy[field]
      if (Object.keys(copy).length === 0) delete next[key]
      else next[key] = copy
      return next
    })
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem(type)])
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key))
    setItemErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function handleProductSelect(key: string, productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        return {
          ...item,
          description: product.name,
          productId: product.id,
          unitPrice: "0",
        }
      })
    )
    setItemErrors((prev) => {
      const cur = prev[key]
      if (!cur?.description) return prev
      const next = { ...prev }
      const copy = { ...cur }
      delete copy.description
      if (Object.keys(copy).length === 0) delete next[key]
      else next[key] = copy
      return next
    })
  }

  const totals = useMemo(() => {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let grandTotal = 0

    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      const discPct = parseFloat(item.discountPercent) || 0
      const taxPct = parseFloat(item.taxPercent) || 0
      const lineSub = qty * price
      const disc = lineSub * (discPct / 100)
      const taxable = lineSub - disc
      const tax = taxable * (taxPct / 100)

      subtotal += lineSub
      discountTotal += disc
      taxTotal += tax
      grandTotal += taxable + tax
    }

    return { subtotal, discountTotal, taxTotal, grandTotal }
  }, [items])

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    const newItemErrors: Record<string, LineItemErrors> = {}

    const effectiveClientId =
      invoice?.clientId ?? client?.id ?? selectedClientId ?? ""
    if (!effectiveClientId.trim()) {
      newErrors.clientId = t("sales.selectClient")
    }
    if (!issueDate) {
      newErrors.issueDate = t("actions.sales.issueDateRequired")
    }
    if (!invoice && paidAmount) {
      const paid = parseFloat(paidAmount)
      if (isNaN(paid) || paid < 0) {
        newErrors.paidAmount = t("actions.sales.validationFailed")
      }
    }
    if (items.length === 0) {
      newErrors.items = t("sales.lineItemsRequired")
    }

    for (const item of items) {
      const ie: LineItemErrors = {}
      if (!item.description.trim()) {
        ie.description = t("actions.sales.descriptionRequired")
      }
      if (!item.quantity.trim()) {
        ie.quantity = t("actions.sales.quantityRequired")
      } else {
        const q = parseFloat(item.quantity)
        if (isNaN(q) || q <= 0) {
          ie.quantity = t("actions.sales.quantityRequired")
        }
      }
      if (!item.unitPrice.trim()) {
        ie.unitPrice = t("actions.sales.unitPriceRequired")
      } else {
        const p = parseFloat(item.unitPrice)
        if (isNaN(p) || p < 0) {
          ie.unitPrice = t("actions.sales.unitPriceRequired")
        }
      }
      if (item.discountPercent) {
        const d = parseFloat(item.discountPercent)
        if (isNaN(d) || d < 0 || d > 100) {
          ie.discountPercent = "Discount must be 0-100"
        }
      }
      if (item.taxPercent) {
        const tx = parseFloat(item.taxPercent)
        if (isNaN(tx) || tx < 0 || tx > 100) {
          ie.taxPercent = "Tax must be 0-100"
        }
      }
      if (Object.keys(ie).length > 0) {
        newItemErrors[item.key] = ie
      }
    }

    setErrors(newErrors)
    setItemErrors(newItemErrors)
    return (
      Object.keys(newErrors).length === 0 &&
      Object.keys(newItemErrors).length === 0
    )
  }

  function mapServerFieldErrors(
    fieldErrors: Record<string, string[] | undefined>
  ) {
    const newErrors: Record<string, string> = {}
    const newItemErrors: Record<string, LineItemErrors> = {
      ...itemErrors,
    }
    let hasItemLevel = false

    for (const [key, msgs] of Object.entries(fieldErrors)) {
      const msg = msgs?.[0]
      if (!msg) continue
      if (key === "clientId" || key === "issueDate" || key === "type") {
        newErrors[key] = msg
      } else if (key === "items" || key.startsWith("items")) {
        // Try to parse items.N.field pattern
        const match =
          key.match(/^items\.(\d+)\.(.+)$/) ??
          key.match(/^items\[(\d+)\]\.(.+)$/)
        if (match) {
          const idx = parseInt(match[1], 10)
          const field = match[2] as keyof LineItem
          const item = items[idx]
          if (item) {
            newItemErrors[item.key] = {
              ...(newItemErrors[item.key] ?? {}),
              [field]: msg,
            }
            hasItemLevel = true
          } else {
            newErrors.items = msg
          }
        } else {
          newErrors.items = msg
        }
      } else if (key.includes(".")) {
        // nested like items.0.description via flatten fallback
        newErrors.items = msg
      } else {
        newErrors[key] = msg
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }))
    }
    if (
      hasItemLevel ||
      Object.keys(newItemErrors).length !==
        Object.keys(itemErrors).length
    ) {
      setItemErrors(newItemErrors)
    }
    // also handle case where server sent fieldErrors.items as single message
    if (
      newErrors.items &&
      !hasItemLevel &&
      Object.keys(newItemErrors).length === 0
    ) {
      // keep itemErrors empty but show form-level items error
    }
  }

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()

    if (!validate()) return

    const effectiveClientId =
      invoice?.clientId ?? client?.id ?? selectedClientId ?? ""
    const result = await onSubmit(
      {
        type,
        clientId: effectiveClientId,
        issueDate,
        dueDate,
        paidAmount: invoice ? "0" : paidAmount,
        notes: invoice?.notes ?? "",
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
          productId: item.productId,
        })),
      },
      invoice?.id
    )

    if (!result.success && result.fieldErrors) {
      mapServerFieldErrors(result.fieldErrors)
    }

    // caller handles toast + dialog close; we keep errors visible
    return result
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.type || undefined}>
            <FieldLabel htmlFor="type">{t("sales.type")}</FieldLabel>
            <Select
              value={type}
              onValueChange={(v: "product" | "service") => setType(v)}
            >
              <SelectTrigger
                id="type"
                className="w-full"
                aria-invalid={!!errors.type || undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">
                  {t("sales.product")}
                </SelectItem>
                <SelectItem value="service">
                  {t("sales.service")}
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.type && <FieldError>{errors.type}</FieldError>}
          </Field>

          {selectedClientId ? null : (
            <Field data-invalid={!!errors.clientId || undefined}>
              <FieldLabel htmlFor="client">
                {t("sales.client")}
              </FieldLabel>
              <ClientCombobox
                value={client}
                disabled={!!invoice}
                onValueChange={(c) => {
                  setClient(c)
                  if (errors.clientId) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.clientId
                      return next
                    })
                  }
                }}
              />
              {errors.clientId && (
                <FieldError>{errors.clientId}</FieldError>
              )}
            </Field>
          )}

          <Field data-invalid={!!errors.issueDate || undefined}>
            <FieldLabel htmlFor="issueDate">
              {t("sales.issueDate")}
            </FieldLabel>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value)
                if (errors.issueDate) {
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.issueDate
                    return next
                  })
                }
              }}
              aria-invalid={!!errors.issueDate || undefined}
            />
            {errors.issueDate && (
              <FieldError>{errors.issueDate}</FieldError>
            )}
          </Field>
          <Field data-invalid={!!errors.dueDate || undefined}>
            <FieldLabel htmlFor="dueDate">
              {t("sales.dueDate")}
            </FieldLabel>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value)
                if (errors.dueDate) {
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.dueDate
                    return next
                  })
                }
              }}
              aria-invalid={!!errors.dueDate || undefined}
            />
            {errors.dueDate && (
              <FieldError>{errors.dueDate}</FieldError>
            )}
          </Field>
          {!invoice && (
            <Field data-invalid={!!errors.paidAmount || undefined}>
              <FieldLabel htmlFor="paidAmount">
                {t("sales.amountPaid")}
              </FieldLabel>
              <MoneyInput
                id="paidAmount"
                value={paidAmount}
                onChange={(v) => {
                  setPaidAmount(v)
                  if (errors.paidAmount) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.paidAmount
                      return next
                    })
                  }
                }}
                aria-invalid={!!errors.paidAmount || undefined}
              />
              {errors.paidAmount && (
                <FieldError>{errors.paidAmount}</FieldError>
              )}
            </Field>
          )}
        </div>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {t("sales.lineItems")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("sales.addItem")}
          </Button>
        </div>

        {errors.items && <FieldError>{errors.items}</FieldError>}

        {loadingItems ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <LineItemsTable
            type={type}
            items={items}
            products={products}
            onUpdate={updateItem}
            onRemove={removeItem}
            onProductSelect={handleProductSelect}
            itemErrors={itemErrors}
          />
        )}
      </div>

      <div className="flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            {t("sales.subtotal")}
          </span>
          <span className="font-mono">
            ${totals.subtotal.toFixed(2)}
          </span>
        </div>
        {totals.discountTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("sales.discount")}
            </span>
            <span className="font-mono text-destructive">
              -${totals.discountTotal.toFixed(2)}
            </span>
          </div>
        )}
        {totals.taxTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {t("sales.tax")}
            </span>
            <span className="font-mono">
              ${totals.taxTotal.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="font-mono">
            ${totals.grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("sales.cancel")}
        </Button>
        <Button type="submit">
          {invoice
            ? t("sales.saveChanges")
            : t("sales.createInvoiceBtn")}
        </Button>
      </div>
    </form>
  )
}
