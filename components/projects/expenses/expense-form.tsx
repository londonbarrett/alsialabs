'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { upsertExpense } from '@/lib/actions/expenses'
import type { ExpenseWithCategory } from '@/lib/actions/expenses'
import { toast } from 'sonner'

interface ExpenseFormProps {
  expense?: ExpenseWithCategory
  projectId: string
  categories: { id: string; slug: string }[]
  onSuccess: () => void
  onCancel: () => void
}

export function ExpenseForm({
  expense,
  projectId,
  categories,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const t = useTranslations()
  const tc = useTranslations('category-names')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? '')
  const [amount, setAmount] = useState(expense?.amount ?? '')
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim()) fieldErrors.description = t('projects.expenses.descriptionRequired')
    if (!categoryId) fieldErrors.categoryId = t('projects.expenses.categoryRequired')
    if (!amount.trim()) fieldErrors.amount = t('projects.expenses.amountRequired')
    if (!expenseDate) fieldErrors.expenseDate = t('projects.expenses.dateRequired')
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const result = await upsertExpense(
        { description: description.trim(), categoryId, amount: amount.trim(), expenseDate },
        projectId,
        expense?.id
      )
      if (result.success) {
        toast.success(expense ? t('projects.expenses.expenseUpdated') : t('projects.expenses.expenseCreated'))
        onSuccess()
      } else {
        if (result.fieldErrors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(result.fieldErrors)) {
            if (msgs && msgs.length > 0) mapped[key] = msgs[0]
          }
          setErrors(mapped)
        }
        toast.error(result.error || t('common.somethingWentWrong'))
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="description"
        label={t('projects.expenses.description')}
        value={description}
        onChange={setDescription}
        error={errors.description}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">{t('projects.expenses.category')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="categoryId" aria-invalid={!!errors.categoryId} aria-describedby={errors.categoryId ? 'categoryId-error' : undefined}>
              <SelectValue placeholder={t('projects.expenses.selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {tc(cat.slug)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && (
            <p id="categoryId-error" className="text-xs text-destructive" role="alert">
              {errors.categoryId}
            </p>
          )}
        </div>

        <Field
          name="amount"
          label={t('projects.expenses.amount')}
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          type="money"
        />
      </div>

      <Field
        name="expenseDate"
        label={t('projects.expenses.date')}
        value={expenseDate}
        onChange={setExpenseDate}
        error={errors.expenseDate}
        type="date"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {expense ? t('common.saveChanges') : t('projects.expenses.createExpense')}
        </Button>
      </div>
    </form>
  )
}
