"use client"

import { ProductForm } from "@/components/products/product-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Product } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

interface StoreOption {
  id: string
  name: string
}

interface ProductDialogProps {
  product?: Product
  stores: StoreOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProductDialog({
  product,
  stores,
  open,
  onOpenChange,
  onSuccess,
}: ProductDialogProps) {
  const t = useTranslations("products")
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {product ? t("editProduct") : t("addProduct")}
          </DialogTitle>
          <DialogDescription>
            {product ? t("updateDetails") : t("fillDetails")}
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          product={product}
          stores={stores}
          onSuccess={() => {
            onSuccess()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
