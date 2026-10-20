"use client"

import { useTranslations } from "next-intl"
import { LineItemsRow } from "./line-items-row"

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
  const t = useTranslations()
  return (
    <div className="max-h-72 overflow-auto">
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t("sales.noItems")}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="min-w-40 py-2 pr-2 font-medium">
                {type === "product"
                  ? t("invoice.product")
                  : t("invoice.service")}
              </th>
              <th className="w-24 px-2 py-2 font-medium">
                {t("invoice.qty")}
              </th>
              <th className="w-32 px-2 py-2 font-medium">
                {t("invoice.unitPrice")}
              </th>
              <th className="w-24 px-2 py-2 font-medium">
                {t("sales.discPercent")}
              </th>
              <th className="w-24 px-2 py-2 font-medium">
                {t("sales.taxPercent")}
              </th>
              <th className="w-28 px-2 py-2 text-right font-medium">
                {t("common.total")}
              </th>
              <th className="w-12 py-2 pl-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <LineItemsRow
                key={item.key}
                item={item}
                type={type}
                products={products}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onProductSelect={onProductSelect}
                error={itemErrors[item.key]}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
