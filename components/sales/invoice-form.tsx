"use client"

import { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClientCombobox } from "@/components/clients/client-combobox"
import { Plus } from "lucide-react"
import { upsertInvoice, getInvoiceItems } from "@/lib/actions/sales"
import type { Invoice } from "@/lib/drizzle/schema"
import { toast } from "sonner"
import {
  LineItemsTable,
  type LineItem,
} from "@/components/sales/line-items-table"

interface InvoiceFormProps {
  invoice?: Invoice
  clients: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
  selectedClientId?: string
  onSuccess: () => void
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
  clients,
  products,
  selectedClientId,
  onSuccess,
  onCancel,
}: InvoiceFormProps) {
  const t = useTranslations()
  const [type, setType] = useState<"product" | "service">(
    (invoice?.type as "product" | "service") ?? "product"
  )
  const [clientId, setClientId] = useState(
    invoice?.clientId ?? selectedClientId ?? ""
  )
  const [issueDate, setIssueDate] = useState(
    invoice?.issueDate ?? new Date().toISOString().slice(0, 10)
  )

  const [items, setItems] = useState<LineItem[]>(() =>
    invoice?.id ? [] : [createEmptyItem("product")]
  )
  const loadingItems = invoice?.id != null && items.length === 0
  const [saving, setSaving] = useState(false)

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
      .catch(() => toast.error(t('sales.failedToLoadItems')))
  }, [invoice?.id])

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
  }

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem(type)])
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key))
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

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault()

    if (!clientId) {
      toast.error(t('sales.selectClient'))
      return
    }

    if (items.length === 0) {
      toast.error(t('sales.lineItemsRequired'))
      return
    }

    setSaving(true)
    try {
      const result = await upsertInvoice(
        {
          type,
          clientId,
          issueDate,
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
      if (result.success) {
        toast.success(invoice ? t('sales.invoiceUpdated') : t('sales.invoiceCreated'))
        onSuccess()
      } else {
        toast.error(result.error || t('common.somethingWentWrong'))
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">{t('sales.type')}</Label>
          <Select
            value={type}
            onValueChange={(v: "product" | "service") => setType(v)}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">{t('sales.product')}</SelectItem>
              <SelectItem value="service">{t('sales.service')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedClientId && !invoice ? null : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="client">{t('sales.client')}</Label>
            <ClientCombobox
              clients={clients}
              value={clientId}
              onValueChange={(id) => setClientId(id ?? "")}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="issueDate">{t('sales.issueDate')}</Label>
          <Input
            id="issueDate"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{t('sales.lineItems')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('sales.addItem')}
          </Button>
        </div>

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
          />
        )}
      </div>

      <div className="flex flex-col gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('sales.subtotal')}</span>
          <span className="font-mono">
            ${totals.subtotal.toFixed(2)}
          </span>
        </div>
        {totals.discountTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sales.discount')}</span>
            <span className="font-mono text-destructive">
              -${totals.discountTotal.toFixed(2)}
            </span>
          </div>
        )}
        {totals.taxTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('sales.tax')}</span>
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
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t('sales.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {invoice ? t('sales.saveChanges') : t('sales.createInvoiceBtn')}
        </Button>
      </div>
    </form>
  )
}
