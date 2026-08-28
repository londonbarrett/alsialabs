"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExpenseWithCategory } from "@/lib/types"
import type { Task } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"

type ExpenseRow =
  | { key: string; type: "task"; task: Task; date: string }
  | {
      key: string
      type: "expense"
      expense: ExpenseWithCategory
      date: string
    }

interface ExpensesTableProps {
  rows: ExpenseRow[]
  canEdit: boolean
  canDelete: boolean
  onEditExpense: (expense: ExpenseWithCategory) => void
  onEditTask: (task: Task) => void
  onDeleteExpense: (expenseId: string) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}

export function ExpensesTable({
  rows,
  canEdit,
  canDelete,
  onEditExpense,
  onEditTask,
  onDeleteExpense,
  onDeleteTask,
}: ExpensesTableProps) {
  const t = useTranslations()

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {t("projects.expenses.description")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.expenses.type")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.expenses.amount")}
            </TableHead>
            <TableHead scope="col">
              {t("projects.expenses.date")}
            </TableHead>
            {(canEdit || canDelete) && (
              <TableHead scope="col">{t("common.actions")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">
                {row.type === "task"
                  ? row.task.name
                  : row.expense.description}
              </TableCell>
              <TableCell>
                {row.type === "task" ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {t("projects.expenses.task")}
                  </Badge>
                ) : row.expense.categorySlug ? (
                  <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                    {t.has(`categoryNames.${row.expense.categorySlug}`)
                      ? t(`categoryNames.${row.expense.categorySlug}`)
                      : row.expense.categoryName}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {row.type === "task" ? (
                  <Money value={row.task.cost} />
                ) : (
                  <Money value={row.expense.amount} />
                )}
              </TableCell>
              <TableCell>{row.date}</TableCell>
              {(canEdit || canDelete) && (
                <TableCell>
                  <ActionMenu
                    entityName={
                      row.type === "task"
                        ? row.task.name
                        : row.expense.description
                    }
                    onEdit={
                      canEdit
                        ? () =>
                            row.type === "task"
                              ? onEditTask(row.task)
                              : onEditExpense(row.expense)
                        : undefined
                    }
                    onDelete={() =>
                      row.type === "task"
                        ? onDeleteTask(row.task.id)
                        : onDeleteExpense(row.expense.id)
                    }
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
