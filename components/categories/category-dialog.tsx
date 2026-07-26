'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CategoryForm } from './category-form'
import type { Category } from '@/lib/drizzle/schema'

interface CategoryDialogProps {
  category?: Category
  taxonomyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CategoryDialog({ category, taxonomyId, open, onOpenChange, onSuccess }: CategoryDialogProps) {
  const t = useTranslations('categories')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{category ? t('editCategory') : t('addCategory')}</DialogTitle>
          <DialogDescription>
            {category ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <CategoryForm
          category={category}
          taxonomyId={taxonomyId}
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
