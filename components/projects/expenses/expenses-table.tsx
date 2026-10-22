"use client"

import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"
import type { ProjectInvoiceDTO } from "@/actions/schemas/invoice"
import type { TaskWithCommentCountDTO } from "@/actions/schemas/task"
import { ActionMenu } from "@/components/common/action-menu"
import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ListTodo, Receipt, Unlink } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

type CombinedExpenseRow =
  | {
      key: string
      type: "task"
      task: TaskWithCommentCountDTO
      date: string
    }
  | {
      key: string
      type: "expense"
      expense: ExpenseWithCategoryDTO
      date: string
    }
  | {
      key: string
      type: "invoice"
      invoice: ProjectInvoiceDTO
      date: string
    }

interface ExpensesTableProps {
  rows: CombinedExpenseRow[]
  canEdit: boolean
  canDelete: boolean
  onEditExpense: (expense: ExpenseWithCategoryDTO) => void
  onEditTask: (task: TaskWithCommentCountDTO) => void
  onDeleteExpense: (expenseId: string) => void
  onDeleteTask: (taskId: string) => void
  onUnbindInvoice?: (invoiceId: string) => void
}

export function ExpensesTable({
  rows,
  canEdit,
  canDelete,
  onEditExpense,
  onEditTask,
  onDeleteExpense,
  onDeleteTask,
  onUnbindInvoice,
}: ExpensesTableProps) {
  const t = useTranslations()
  const [unbindTarget, setUnbindTarget] =
    useState<ProjectInvoiceDTO | null>(null)

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("common.description")}</TableHead>
            <TableHead scope="col">{t("common.type")}</TableHead>
            <TableHead scope="col">{t("common.amount")}</TableHead>
            <TableHead scope="col">{t("common.date")}</TableHead>
            {(canEdit || canDelete) && (
              <TableHead scope="col">{t("common.actions")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {row.type === "task" ? (
                    <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {row.type === "task"
                    ? row.task.name
                    : row.type === "invoice"
                      ? row.invoice.invoiceNumber
                      : row.expense.description}
                </span>
              </TableCell>
              <TableCell>
                {row.type === "task" ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    {t("common.task")}
                  </Badge>
                ) : row.type === "invoice" ? (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                    {t("common.invoice")}
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
                ) : row.type === "invoice" ? (
                  <Money value={row.invoice.paidAmount} />
                ) : (
                  <Money value={row.expense.amount} />
                )}
              </TableCell>
              <TableCell>{row.date}</TableCell>
              {(canEdit || canDelete) && (
                <TableCell>
                  {row.type === "invoice" ? (
                    <ActionMenu
                      entityName={row.invoice.invoiceNumber}
                      canEdit={false}
                      canDelete={false}
                    >
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onClick={() => setUnbindTarget(row.invoice)}
                      >
                        <Unlink className="mr-2 h-4 w-4" />
                        {t("myInvoices.unbindToProject")}
                      </DropdownMenuItem>
                    </ActionMenu>
                  ) : (
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
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DestructiveDialog
        open={unbindTarget !== null}
        title={t("myInvoices.unbindToProject")}
        message={t("myInvoices.confirmUnbind")}
        confirmLabel={t("myInvoices.unbind")}
        onConfirm={() => {
          if (unbindTarget) onUnbindInvoice?.(unbindTarget.id)
          setUnbindTarget(null)
        }}
        onCancel={() => setUnbindTarget(null)}
      />
    </div>
  )
}
