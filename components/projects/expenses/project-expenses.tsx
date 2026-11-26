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
import { sumMoney } from "@/lib/costs/delta"
import { formatDueDate } from "@/lib/util/tasks"
import { useExpensesActions } from "@/stores/expenses/use-expenses-actions"
import { useExpensesState } from "@/stores/expenses/use-expenses-state"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { useProjectTasksState } from "@/stores/project-tasks/use-project-tasks-state"
import { cn } from "cn"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { ExpenseDialog } from "./expense-dialog"
import { ExpensesTable } from "./expenses-table"

interface ProjectExpensesProps {
  categories: { id: string; slug: string; name: string }[]
}

function formatRowDate(
  value: Date | string,
  locale: string,
  timeZone: string
): string {
  // DB date columns are calendar days, not instants; midday keeps the same
  // day after conversion into the project's zone.
  const date =
    value instanceof Date ? value : new Date(`${value}T12:00:00`)
  return formatDueDate(date, locale, timeZone, null)
}

export function ProjectExpenses({ categories }: ProjectExpensesProps) {
  const t = useTranslations()
  const locale = useLocale()
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
  const { tasks } = useProjectTasksState()
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

  // Only tasks with closed assignments have anything to show or count.
  const taskRows = tasks.filter((task) => task.closedCount > 0)
  const total = sumMoney([
    ...expenses.map((e) => e.amount),
    ...invoices.map((i) => i.paidAmount),
    ...taskRows.map((task) => task.totalCost),
  ])
  const hasItems =
    expenses.length > 0 || invoices.length > 0 || taskRows.length > 0
  const budgetNum = budget ? Number(budget) : 0
  const spendPct =
    budgetNum > 0
      ? Math.min(100, Math.round((total / budgetNum) * 100))
      : 0
  const overBudget = budgetNum > 0 && total > budgetNum

  const rows = [
    ...taskRows.map((task) => ({
      key: `task-${task.id}`,
      type: "task" as const,
      task,
      date: task.createdAt
        ? formatRowDate(new Date(task.createdAt), locale, project.timeZone)
        : "—",
      sortDate: task.createdAt ? new Date(task.createdAt).toISOString() : "",
    })),
    ...expenses.map((expense) => ({
      key: expense.id,
      type: "expense" as const,
      expense,
      date: formatRowDate(expense.expenseDate, locale, project.timeZone),
      sortDate: expense.expenseDate,
    })),
    ...invoices.map((invoice) => ({
      key: invoice.id,
      type: "invoice" as const,
      invoice,
      date: formatRowDate(invoice.issueDate, locale, project.timeZone),
      sortDate: invoice.issueDate,
    })),
  ].sort((a, b) => b.sortDate.localeCompare(a.sortDate))

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
              timeZone={project.timeZone}
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
