"use client"

import { MoneyInput } from "@/components/common/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { formatCurrency } from "@/lib/util/money"
import type { LineItem, LineItemErrors } from "./line-items-table"

function computeLineTotal(
  qty: number,
  price: number,
  discPct: number,
  taxPct: number
): number {
  const sub = qty * price
  const disc = sub * (discPct / 100)
  const taxable = sub - disc
  return taxable + taxable * (taxPct / 100)
}

interface LineItemsRowProps {
  item: LineItem
  type: "product" | "service"
  products: Array<{ id: string; name: string }>
  onUpdate: (key: string, field: keyof LineItem, value: string) => void
  onRemove: (key: string) => void
  onProductSelect: (key: string, productId: string) => void
  error?: LineItemErrors
}

export function LineItemsRow({
  item,
  type,
  products,
  onUpdate,
  onRemove,
  onProductSelect,
  error,
}: LineItemsRowProps) {
  const t = useTranslations("sales")
  const qty = parseFloat(item.quantity) || 0
  const price = parseFloat(item.unitPrice) || 0
  const discPct = parseFloat(item.discountPercent) || 0
  const taxPct = parseFloat(item.taxPercent) || 0
  const lineTotal = computeLineTotal(qty, price, discPct, taxPct)

  return (
    <tr className="border-b align-top last:border-b-0">
      <td className="py-1.5 pr-2">
        {type === "product" ? (
          <div className="flex flex-col gap-1">
            <Select
              value={item.productId ?? ""}
              onValueChange={(v) => onProductSelect(item.key, v)}
            >
              <SelectTrigger
                className="h-8 w-full text-xs"
                aria-invalid={!!error?.description || undefined}
                data-invalid={!!error?.description || undefined}
              >
                <SelectValue placeholder={t("selectProduct")} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error?.description && (
              <p className="text-[11px] text-destructive" role="alert">
                {error.description}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Input
              className="h-8 text-xs"
              placeholder={t("serviceDescriptionPlaceholder")}
              value={item.description}
              onChange={(e) =>
                onUpdate(item.key, "description", e.target.value)
              }
              aria-invalid={!!error?.description || undefined}
              data-invalid={!!error?.description || undefined}
            />
            {error?.description && (
              <p className="text-[11px] text-destructive" role="alert">
                {error.description}
              </p>
            )}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-1">
          <Input
            className="h-8 text-xs"
            type="number"
            step="any"
            min="0"
            value={item.quantity}
            onChange={(e) => onUpdate(item.key, "quantity", e.target.value)}
            aria-invalid={!!error?.quantity || undefined}
            data-invalid={!!error?.quantity || undefined}
          />
          {error?.quantity && (
            <p className="text-[11px] text-destructive" role="alert">
              {error.quantity}
            </p>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-1">
          <MoneyInput
            className="h-8 text-xs"
            value={item.unitPrice}
            onChange={(v) => onUpdate(item.key, "unitPrice", v)}
            aria-invalid={!!error?.unitPrice || undefined}
          />
          {error?.unitPrice && (
            <p className="text-[11px] text-destructive" role="alert">
              {error.unitPrice}
            </p>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-1">
          <Input
            className="h-8 text-xs"
            type="number"
            step="any"
            min="0"
            max="100"
            value={item.discountPercent}
            onChange={(e) =>
              onUpdate(item.key, "discountPercent", e.target.value)
            }
            aria-invalid={!!error?.discountPercent || undefined}
            data-invalid={!!error?.discountPercent || undefined}
          />
          {error?.discountPercent && (
            <p className="text-[11px] text-destructive" role="alert">
              {error.discountPercent}
            </p>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex flex-col gap-1">
          <Input
            className="h-8 text-xs"
            type="number"
            step="any"
            min="0"
            max="100"
            value={item.taxPercent}
            onChange={(e) => onUpdate(item.key, "taxPercent", e.target.value)}
            aria-invalid={!!error?.taxPercent || undefined}
            data-invalid={!!error?.taxPercent || undefined}
          />
          {error?.taxPercent && (
            <p className="text-[11px] text-destructive" role="alert">
              {error.taxPercent}
            </p>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-xs">
        {formatCurrency(lineTotal)}
      </td>
      <td className="py-1.5 pl-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(item.key)}
          aria-label={t("removeItem")}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}
