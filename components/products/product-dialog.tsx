'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ProductForm } from '@/components/products/product-form'
import type { Product } from '@/lib/drizzle/schema'

interface ProviderOption {
  id: string
  name: string
}

interface ProductDialogProps {
  product?: Product
  providers: ProviderOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProductDialog({ product, providers, open, onOpenChange, onSuccess }: ProductDialogProps) {
  const t = useTranslations('products')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{product ? t('editProduct') : t('addProduct')}</DialogTitle>
          <DialogDescription>
            {product ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          product={product}
          providers={providers}
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
