'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ExpenseCategoryForm } from './expense-category-form'
import type { ExpenseCategory } from '@/lib/drizzle/schema'

interface ExpenseCategoryDialogProps {
  category?: ExpenseCategory
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ExpenseCategoryDialog({ category, open, onOpenChange, onSuccess }: ExpenseCategoryDialogProps) {
  const t = useTranslations('expense-categories')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{category ? t('editCategory') : t('addCategory')}</DialogTitle>
          <DialogDescription>
            {category ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <ExpenseCategoryForm
          category={category}
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
