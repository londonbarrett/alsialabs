'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { upsertInvoice, getInvoiceItems } from '@/lib/actions/sales'
import type { Invoice } from '@/lib/drizzle/schema'
import { toast } from 'sonner'
import { LineItemsTable, type LineItem } from '@/components/sales/line-items-table'

interface SalesFormProps {
  invoice?: Invoice
  clients: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
  onSuccess: () => void
  onCancel: () => void
}

let itemKeyCounter = 0
function nextKey() { return `item_${++itemKeyCounter}` }

function createEmptyItem(type: string, product?: { id: string; name: string }): LineItem {
  return {
    key: nextKey(),
    description: product ? product.name : '',
    quantity: '1',
    unitPrice: '0',
    discountPercent: '0',
    taxPercent: '0',
    productId: product ? product.id : null,
  }
}

export function SalesForm({ invoice, clients, products, onSuccess, onCancel }: SalesFormProps) {
  const [type, setType] = useState<'product' | 'service'>(invoice?.type as 'product' | 'service' ?? 'product')
  const [clientId, setClientId] = useState(invoice?.clientId ?? '')
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? new Date().toISOString().slice(0, 10))

  const [items, setItems] = useState<LineItem[]>(() =>
    invoice?.id ? [] : [createEmptyItem('product')],
  )
  const loadingItems = invoice?.id != null && items.length === 0
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!invoice?.id) return
    getInvoiceItems(invoice.id)
      .then((data) => {
        setItems(data.map((item) => ({
          key: nextKey(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxPercent: item.taxPercent,
          productId: item.productId,
        })))
      })
      .catch(() => toast.error('Failed to load invoice items'))
  }, [invoice?.id])

  function updateItem(key: string, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((item) => {
      if (item.key !== key) return item
      return { ...item, [field]: value }
    }))
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
    setItems((prev) => prev.map((item) => {
      if (item.key !== key) return item
      return { ...item, description: product.name, productId: product.id, unitPrice: '0' }
    }))
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clientId) {
      toast.error('Please select a client')
      return
    }

    if (items.length === 0) {
      toast.error('At least one line item is required')
      return
    }

    setSaving(true)
    try {
      const result = await upsertInvoice(
        {
          type,
          clientId,
          issueDate,
          notes: invoice?.notes ?? '',
          items: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxPercent: item.taxPercent,
            productId: item.productId,
          })),
        },
        invoice?.id,
      )
      if (result.success) {
        toast.success(invoice ? 'Invoice updated' : 'Invoice created')
        onSuccess()
      } else {
        toast.error(result.error || 'Something went wrong')
      }
    } catch {
      toast.error('Something went wrong')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={(v: 'product' | 'service') => setType(v)}>
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="client">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client" className="w-full">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="issueDate">Issue Date</Label>
          <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" />
            Add Item
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

      <div className="border-t pt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">${totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.discountTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-mono text-destructive">-${totals.discountTotal.toFixed(2)}</span>
          </div>
        )}
        {totals.taxTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">${totals.taxTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold border-t pt-1">
          <span>Total</span>
          <span className="font-mono">${totals.grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {invoice ? 'Save Changes' : 'Create Invoice'}
        </Button>
      </div>
    </form>
  )
}
