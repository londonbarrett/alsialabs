"use client"

import { Dialog } from "@/components/common/dialog"
import { useTranslations } from "next-intl"
import { ExpenseForm } from "./expense-form"
import type { Expense } from "@/lib/drizzle/schema"
import type { ExpenseWithCategory } from "@/lib/types"

interface ExpenseDialogProps {
  expense?: ExpenseWithCategory
  projectId: string
  categories: { id: string; slug: string; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Expense) => void
}

export function ExpenseDialog({
  expense,
  projectId,
  categories,
  open,
  onOpenChange,
  onSubmit,
}: ExpenseDialogProps) {
  const t = useTranslations("projects.expenses")
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? t("editExpense") : t("addExpense")}
      description={expense ? t("updateDetails") : t("fillDetails")}
      onInteractOutside={(e) => e.preventDefault()}
    >
      <ExpenseForm
        expense={expense}
        projectId={projectId}
        categories={categories}
        onSubmit={onSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
