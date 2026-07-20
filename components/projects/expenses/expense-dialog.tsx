'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ExpenseForm } from './expense-form'
import type { ExpenseWithCategory } from '@/lib/actions/expenses'

interface ExpenseDialogProps {
  expense?: ExpenseWithCategory
  projectId: string
  categories: { id: string; slug: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ExpenseDialog({
  expense,
  projectId,
  categories,
  open,
  onOpenChange,
  onSuccess,
}: ExpenseDialogProps) {
  const t = useTranslations('projects.expenses')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {expense ? t('editExpense') : t('addExpense')}
          </DialogTitle>
          <DialogDescription>
            {expense ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <ExpenseForm
          expense={expense}
          projectId={projectId}
          categories={categories}
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
