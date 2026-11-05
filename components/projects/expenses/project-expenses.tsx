"use client"

import { Money } from "@/components/common/money"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import type { Expense } from "@/lib/drizzle/schema"
import type { ExpenseWithCategoryDTO } from "@/actions/expenses/schemas"
import { useExpensesActions } from "@/stores/expenses/use-expenses-actions"
import { useExpensesState } from "@/stores/expenses/use-expenses-state"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { cn } from "cn"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { ExpenseDialog } from "./expense-dialog"
import { ExpensesTable } from "./expenses-table"

interface ProjectExpensesProps {
  categories: { id: string; slug: string; name: string }[]
}

export function ProjectExpenses({ categories }: ProjectExpensesProps) {
  const t = useTranslations()
  const { project, projectId, isOwner, isAdmin } =
    useProjectContextState()
  const budget = project.budget ?? null
  const canEditProject = useHasPermission("projects:edit")
  const canEdit =
    useHasPermission("expenses:create") ||
    ((isOwner || isAdmin) && canEditProject)
  const canDeleteExpense = useHasPermission("expenses:delete")
  const canDelete = canDeleteExpense || isOwner || isAdmin

  const { expenses, invoices } = useExpensesState()
  const { saveExpense, deleteExpense, unbindInvoice } =
    useExpensesActions()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<
    ExpenseWithCategoryDTO | undefined
  >()

  function openNew() {
    setEditingExpense(undefined)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseWithCategoryDTO) {
    setEditingExpense(expense)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingExpense(undefined)
  }

  function handleDeleteExpense(expenseId: string) {
    deleteExpense({ projectId, expenseId })
  }

  const handleUnbindInvoice = useCallback(
    (invoiceId: string) => {
      unbindInvoice(invoiceId)
    },
    [unbindInvoice]
  )

  function handleExpenseSubmit(data: Expense) {
    saveExpense({ data, categories, editingExpense })
  }

  const expenseTotal = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  )
  const invoicePaidTotal = invoices.reduce(
    (sum, i) => sum + Number(i.paidAmount),
    0
  )
  const total = expenseTotal + invoicePaidTotal
  const hasItems = expenses.length > 0 || invoices.length > 0
  const budgetNum = budget ? Number(budget) : 0
  const spendPct =
    budgetNum > 0
      ? Math.min(100, Math.round((total / budgetNum) * 100))
      : 0
  const overBudget = budgetNum > 0 && total > budgetNum

  const rows = [
    ...expenses.map((expense) => ({
      key: expense.id,
      type: "expense" as const,
      expense,
      date: expense.expenseDate,
    })),
    ...invoices.map((invoice) => ({
      key: invoice.id,
      type: "invoice" as const,
      invoice,
      date: invoice.issueDate,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t("common.expenses")}
          </span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t("projects.expenses.addExpense")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {budgetNum > 0 && (
          <>
            <div className="mb-6 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Wallet className="size-4 text-muted-foreground" />
                  {t("common.budget")}
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    overBudget && "text-red-600 dark:text-red-400"
                  )}
                >
                  <Money value={total} />{" "}
                  <span className="text-muted-foreground">
                    / <Money value={budgetNum} />
                  </span>
                </span>
              </div>
              <Progress
                value={spendPct}
                className={cn(
                  overBudget &&
                    "**:data-[slot=progress-indicator]:bg-red-500"
                )}
              />
              <p className="text-xs text-muted-foreground">
                {t("projects.card.ofBudgetUsed", { pct: spendPct })}
                {overBudget && (
                  <span className="text-red-600 dark:text-red-400">
                    {" "}
                    · {t("projects.card.overBudget")}
                  </span>
                )}
              </p>
            </div>
          </>
        )}
        {hasItems ? (
          <>
            <ExpensesTable
              rows={rows}
              canEdit={canEdit}
              canDelete={canDelete}
              onEditExpense={openEdit}
              onDeleteExpense={handleDeleteExpense}
              onUnbindInvoice={handleUnbindInvoice}
            />
            <div className="mt-4 flex justify-end">
              <p className="text-sm text-muted-foreground">
                {t("common.total")}: <Money value={total} />
              </p>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("projects.expenses.noExpenses")}
          </p>
        )}
      </CardContent>

      <ExpenseDialog
        projectId={projectId}
        expense={editingExpense}
        categories={categories}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={(data) => {
          setDialogOpen(false)
          setEditingExpense(undefined)
          handleExpenseSubmit(data)
        }}
      />
    </Card>
  )
}
