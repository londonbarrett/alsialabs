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

export interface LineItem {
  key: string
  description: string
  quantity: string
  unitPrice: string
  discountPercent: string
  taxPercent: string
  productId: string | null
}

export type LineItemErrors = Partial<Record<keyof LineItem, string>>

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

interface LineItemsTableProps {
  type: "product" | "service"
  items: LineItem[]
  products: Array<{ id: string; name: string }>
  onUpdate: (key: string, field: keyof LineItem, value: string) => void
  onRemove: (key: string) => void
  onProductSelect: (key: string, productId: string) => void
  itemErrors?: Record<string, LineItemErrors>
}

export function LineItemsTable({
  type,
  items,
  products,
  onUpdate,
  onRemove,
  onProductSelect,
  itemErrors = {},
}: LineItemsTableProps) {
  const t = useTranslations("sales")
  return (
    <div className="max-h-72 overflow-auto">
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("noItems")}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="min-w-35 py-2 pr-2 font-medium">
                {type === "product" ? t("product") : t("service")}
              </th>
              <th className="w-20 px-2 py-2 font-medium">{t("qty")}</th>
              <th className="w-24 px-2 py-2 font-medium">
                {t("unitPrice")}
              </th>
              <th className="w-20 px-2 py-2 font-medium">
                {t("discPercent")}
              </th>
              <th className="w-20 px-2 py-2 font-medium">
                {t("taxPercent")}
              </th>
              <th className="w-24 px-2 py-2 text-right font-medium">
                {t("total")}
              </th>
              <th className="w-10 py-2 pl-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const qty = parseFloat(item.quantity) || 0
              const price = parseFloat(item.unitPrice) || 0
              const discPct = parseFloat(item.discountPercent) || 0
              const taxPct = parseFloat(item.taxPercent) || 0
              const lineTotal = computeLineTotal(
                qty,
                price,
                discPct,
                taxPct
              )
              const errs = itemErrors[item.key]

              return (
                <tr
                  key={item.key}
                  className="border-b align-top last:border-b-0"
                >
                  <td className="py-1.5 pr-2">
                    {type === "product" ? (
                      <div className="flex flex-col gap-1">
                        <Select
                          value={item.productId ?? ""}
                          onValueChange={(v) =>
                            onProductSelect(item.key, v)
                          }
                        >
                          <SelectTrigger
                            className="h-8 w-full text-xs"
                            aria-invalid={
                              !!errs?.description || undefined
                            }
                            data-invalid={
                              !!errs?.description || undefined
                            }
                          >
                            <SelectValue
                              placeholder={t("selectProduct")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errs?.description && (
                          <p
                            className="text-[11px] text-destructive"
                            role="alert"
                          >
                            {errs.description}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Input
                          className="h-8 text-xs"
                          placeholder={t(
                            "serviceDescriptionPlaceholder"
                          )}
                          value={item.description}
                          onChange={(e) =>
                            onUpdate(
                              item.key,
                              "description",
                              e.target.value
                            )
                          }
                          aria-invalid={
                            !!errs?.description || undefined
                          }
                          data-invalid={
                            !!errs?.description || undefined
                          }
                        />
                        {errs?.description && (
                          <p
                            className="text-[11px] text-destructive"
                            role="alert"
                          >
                            {errs.description}
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
                        onChange={(e) =>
                          onUpdate(item.key, "quantity", e.target.value)
                        }
                        aria-invalid={!!errs?.quantity || undefined}
                        data-invalid={!!errs?.quantity || undefined}
                      />
                      {errs?.quantity && (
                        <p
                          className="text-[11px] text-destructive"
                          role="alert"
                        >
                          {errs.quantity}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-col gap-1">
                      <MoneyInput
                        className="h-8 text-xs"
                        value={item.unitPrice}
                        onChange={(v) =>
                          onUpdate(item.key, "unitPrice", v)
                        }
                        aria-invalid={!!errs?.unitPrice || undefined}
                      />
                      {errs?.unitPrice && (
                        <p
                          className="text-[11px] text-destructive"
                          role="alert"
                        >
                          {errs.unitPrice}
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
                          onUpdate(
                            item.key,
                            "discountPercent",
                            e.target.value
                          )
                        }
                        aria-invalid={
                          !!errs?.discountPercent || undefined
                        }
                        data-invalid={
                          !!errs?.discountPercent || undefined
                        }
                      />
                      {errs?.discountPercent && (
                        <p
                          className="text-[11px] text-destructive"
                          role="alert"
                        >
                          {errs.discountPercent}
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
                        onChange={(e) =>
                          onUpdate(
                            item.key,
                            "taxPercent",
                            e.target.value
                          )
                        }
                        aria-invalid={!!errs?.taxPercent || undefined}
                        data-invalid={!!errs?.taxPercent || undefined}
                      />
                      {errs?.taxPercent && (
                        <p
                          className="text-[11px] text-destructive"
                          role="alert"
                        >
                          {errs.taxPercent}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs">
                    ${lineTotal.toFixed(2)}
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
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
