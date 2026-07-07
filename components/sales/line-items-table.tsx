'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'

export interface LineItem {
  key: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
  productId: string | null
}

function computeLineTotal(qty: number, price: number, discPct: number, taxPct: number): number {
  const sub = qty * price
  const disc = sub * (discPct / 100)
  const taxable = sub - disc
  return taxable + taxable * (taxPct / 100)
}

interface LineItemsTableProps {
  type: 'product' | 'service'
  items: LineItem[]
  products: Array<{ id: string; name: string }>
  onUpdate: (key: string, field: keyof LineItem, value: string) => void
  onRemove: (key: string) => void
  onProductSelect: (key: string, productId: string) => void
}

export function LineItemsTable({ type, items, products, onUpdate, onRemove, onProductSelect }: LineItemsTableProps) {
  const t = useTranslations('sales')
  return (
    <div className="overflow-auto max-h-72">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t('noItems')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs">
              <th className="py-2 pr-2 font-medium min-w-35">{type === 'product' ? t('product') : t('service')}</th>
              <th className="py-2 px-2 font-medium w-20">{t('qty')}</th>
              <th className="py-2 px-2 font-medium w-24">{t('unitPrice')}</th>
              <th className="py-2 px-2 font-medium w-20">{t('discPercent')}</th>
              <th className="py-2 px-2 font-medium w-20">{t('taxPercent')}</th>
              <th className="py-2 px-2 font-medium w-24 text-right">{t('total')}</th>
              <th className="py-2 pl-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const qty = parseFloat(item.quantity) || 0
              const price = parseFloat(item.unitPrice) || 0
              const discPct = parseFloat(item.discountPercent) || 0
              const taxPct = parseFloat(item.taxPercent) || 0
              const lineTotal = computeLineTotal(qty, price, discPct, taxPct)

              return (
                <tr key={item.key} className="border-b last:border-b-0">
                  <td className="py-1.5 pr-2">
                    {type === 'product' ? (
                      <Select
                        value={item.productId ?? ''}
                        onValueChange={(v) => onProductSelect(item.key, v)}
                      >
                        <SelectTrigger className="w-full h-8 text-xs">
                          <SelectValue placeholder={t('selectProduct')} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className="h-8 text-xs"
                        placeholder={t('serviceDescriptionPlaceholder')}
                        value={item.description}
                        onChange={(e) => onUpdate(item.key, 'description', e.target.value)}
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      step="any"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => onUpdate(item.key, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      step="any"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => onUpdate(item.key, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={item.discountPercent}
                      onChange={(e) => onUpdate(item.key, 'discountPercent', e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      className="h-8 text-xs"
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={item.taxPercent}
                      onChange={(e) => onUpdate(item.key, 'taxPercent', e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs">
                    ${lineTotal.toFixed(2)}
                  </td>
                  <td className="py-1.5 pl-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemove(item.key)}
                      aria-label={t('removeItem')}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
