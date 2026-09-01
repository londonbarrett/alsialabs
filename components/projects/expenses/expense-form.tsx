"use client"

import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Expense } from "@/lib/drizzle/schema"
import type { ExpenseWithCategory } from "@/lib/types"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface ExpenseFormProps {
  expense?: ExpenseWithCategory
  projectId: string
  categories: { id: string; slug: string; name: string }[]
  onSubmit: (data: Expense) => void
  onCancel: () => void
}

export function ExpenseForm({
  expense,
  projectId,
  categories,
  onSubmit,
  onCancel,
}: ExpenseFormProps) {
  const t = useTranslations()
  const [description, setDescription] = useState(
    expense?.description ?? ""
  )
  const [categoryId, setCategoryId] = useState(
    expense?.categoryId ?? ""
  )
  const [amount, setAmount] = useState(expense?.amount ?? "")
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate ?? ""
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!description.trim())
      fieldErrors.description = t(
        "projects.expenses.descriptionRequired"
      )
    if (!categoryId)
      fieldErrors.categoryId = t("projects.expenses.categoryRequired")
    if (!amount.trim())
      fieldErrors.amount = t("projects.expenses.amountRequired")
    if (!expenseDate)
      fieldErrors.expenseDate = t("projects.expenses.dateRequired")
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (!validate()) return

    const now = new Date()
    onSubmit({
      id: expense?.id ?? "",
      projectId,
      categoryId,
      description: description.trim(),
      amount: amount.trim(),
      expenseDate,
      createdAt: expense?.createdAt ?? now,
      updatedAt: now,
    })
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e.nativeEvent as SubmitEvent)}
      className="flex flex-col gap-4"
    >
      <Field
        name="description"
        label={t("projects.expenses.description")}
        value={description}
        onChange={setDescription}
        error={errors.description}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="categoryId">
            {t("projects.expenses.category")}
          </Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger
              id="categoryId"
              aria-invalid={!!errors.categoryId}
              aria-describedby={
                errors.categoryId ? "categoryId-error" : undefined
              }
            >
              <SelectValue
                placeholder={t("projects.expenses.selectCategory")}
              />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {t.has(`categoryNames.${cat.slug}`)
                    ? t(`categoryNames.${cat.slug}`)
                    : cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && (
            <p
              id="categoryId-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {errors.categoryId}
            </p>
          )}
        </div>

        <Field
          name="amount"
          label={t("projects.expenses.amount")}
          value={amount}
          onChange={setAmount}
          error={errors.amount}
          type="money"
        />
      </div>

      <Field
        name="expenseDate"
        label={t("projects.expenses.date")}
        value={expenseDate}
        onChange={setExpenseDate}
        error={errors.expenseDate}
        type="date"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit">
          {expense
            ? t("common.saveChanges")
            : t("projects.expenses.createExpense")}
        </Button>
      </div>
    </form>
  )
}
