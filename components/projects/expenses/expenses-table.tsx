"use client"

import type { ExpenseWithCategoryDTO } from "@/actions/expenses/schemas"
import type { ProjectInvoiceDTO } from "@/actions/invoices/schemas"
import type { TaskWithAssignmentsDTO } from "@/actions/tasks/schemas"
import { ActionMenu } from "@/components/common/action-menu"
import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TaskClosedAssignmentRows } from "@/components/projects/tasks/task-closed-assignment-rows"
import { TaskHistoryPanel } from "@/components/projects/tasks/task-history-panel"
import { sortAssignments } from "@/lib/tasks/assignments"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { cn } from "cn"
import {
  ListChevronsDownUp,
  ListChevronsUpDown,
  ListTodo,
  Receipt,
  RefreshCw,
  Unlink,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Fragment, useState } from "react"

type CombinedExpenseRow =
  | {
      key: string
      type: "task"
      task: TaskWithAssignmentsDTO
      date: string
      sortDate: string
    }
  | {
      key: string
      type: "expense"
      expense: ExpenseWithCategoryDTO
      date: string
      sortDate: string
    }
  | {
      key: string
      type: "invoice"
      invoice: ProjectInvoiceDTO
      date: string
      sortDate: string
    }

interface ExpensesTableProps {
  rows: CombinedExpenseRow[]
  canEdit: boolean
  canDelete: boolean
  /** Project zone every expanded assignment's due date is displayed in. */
  timeZone: string
  onEditExpense: (expense: ExpenseWithCategoryDTO) => void
  onDeleteExpense: (expenseId: string) => void
  onUnbindInvoice?: (invoiceId: string) => void
}

export function ExpensesTable({
  rows,
  canEdit,
  canDelete,
  timeZone,
  onEditExpense,
  onDeleteExpense,
  onUnbindInvoice,
}: ExpensesTableProps) {
  const t = useTranslations()
  const [unbindTarget, setUnbindTarget] =
    useState<ProjectInvoiceDTO | null>(null)
  // Mirrors TasksTable: a row key is expanded while its closed assignments
  // are shown. Keys are the same stable strings used for the rows themselves.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // The header shows Actions only for mutators. The expanded rows pad their
  // filler cells out to this exact column count (columns - 4 leading cells).
  const showActions = canEdit || canDelete
  const columnCount = showActions ? 5 : 4

  return (
    <div className="overflow-auto rounded-md border">
      {/* Fixed widths stop expanded assignment rows from reflowing the table. */}
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead
              scope="col"
              className={showActions ? "w-[40%]" : "w-[45%]"}
            >
              {t("common.description")}
            </TableHead>
            <TableHead
              scope="col"
              className={cn(
                "text-center",
                showActions ? "w-[11%]" : "w-[12%]"
              )}
            >
              {t("common.type")}
            </TableHead>
            <TableHead
              scope="col"
              className={cn(
                "text-center",
                showActions ? "w-[18%]" : "w-[20%]"
              )}
            >
              {t("common.amount")}
            </TableHead>
            <TableHead
              scope="col"
              className={cn(
                "text-center",
                showActions ? "w-[19%]" : "w-[23%]"
              )}
            >
              {t("common.date")}
            </TableHead>
            {showActions && (
              <TableHead scope="col" className="w-[12%] text-center">
                {t("common.actions")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isExpanded = expanded.has(row.key)
            // Only terminal (done/cancelled) assignments cost money. A
            // repeating task keeps its closed history behind the paginated
            // history panel instead of the store's flat assignment list.
            const terminal =
              row.type === "task"
                ? row.task.assignments.filter((assignment) =>
                    isTerminalStatus(assignment.status)
                  )
                : []
            const historySignature = terminal
              .map((assignment) => assignment.id)
              .sort()
              .join(",")

            return (
              <Fragment key={row.key}>
                <TableRow
                  data-sort-date={row.sortDate}
                  className={cn(
                    "[&>td]:py-3",
                    row.type === "task" && "cursor-pointer"
                  )}
                  onClick={
                    row.type === "task" && row.task.closedCount > 0
                      ? () => toggleExpanded(row.key)
                      : undefined
                  }
                >
                  <TableCell className="font-medium">
                    {row.type === "task" ? (
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{row.task.name}</span>
                        {row.task.closedCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t("projects.tasks.closedCount", {
                              count: row.task.closedCount,
                            })}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {row.type === "invoice"
                          ? row.invoice.invoiceNumber
                          : row.expense.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
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
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {row.type === "task" ? (
                        <Money value={row.task.totalCost} />
                      ) : row.type === "invoice" ? (
                        <Money value={row.invoice.paidAmount} />
                      ) : (
                        <Money value={row.expense.amount} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span>{row.date}</span>
                      {row.type === "task" && row.task.recurrence && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge
                                variant="outline"
                                aria-label={t("projects.tasks.recurring")}
                                className="shrink-0"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Badge>
                            }
                          />
                          <TooltipContent>
                            {t("projects.tasks.recurring")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-center">
                      {row.type === "task" ? (
                        row.task.assignments.length > 0 && (
                          <div className="flex justify-center">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={t(
                                      "projects.tasks.assignmentsToggle"
                                    )}
                                    aria-expanded={isExpanded}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      toggleExpanded(row.key)
                                    }}
                                  >
                                    {isExpanded ? (
                                      <ListChevronsDownUp className="h-4 w-4" />
                                    ) : (
                                      <ListChevronsUpDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                }
                              />
                              <TooltipContent>
                                {isExpanded
                                  ? t("projects.tasks.collapseAssignments")
                                  : t("projects.tasks.showAssignments")}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )
                      ) : (
                        <div className="flex justify-center">
                          {row.type === "invoice" ? (
                            <ActionMenu
                              entityName={row.invoice.invoiceNumber}
                              canEdit={false}
                              canDelete={false}
                              actions={[
                                {
                                  key: "unbind",
                                  label: t("myInvoices.unbindToProject"),
                                  icon: Unlink,
                                  destructive: true,
                                  onSelect: () => setUnbindTarget(row.invoice),
                                },
                              ]}
                            />
                          ) : (
                            <ActionMenu
                              entityName={row.expense.description}
                              onEdit={
                                canEdit
                                  ? () => onEditExpense(row.expense)
                                  : undefined
                              }
                              onDelete={() => onDeleteExpense(row.expense.id)}
                              canEdit={canEdit}
                              canDelete={canDelete}
                            />
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
                {row.type === "task" && isExpanded && (
                  row.task.recurrence === null ? (
                    <TaskClosedAssignmentRows
                      taskId={row.task.id}
                      assignments={sortAssignments(terminal)}
                      timeZone={timeZone}
                      columnCount={columnCount}
                      cellOrder="expenses"
                    />
                  ) : (
                    <TaskHistoryPanel
                      taskId={row.task.id}
                      recurrence={row.task.recurrence}
                      timeZone={timeZone}
                      storeTerminal={terminal}
                      openIds={[]}
                      historySignature={historySignature}
                      columnCount={columnCount}
                      cellOrder="expenses"
                      pageSize={30}
                    />
                  )
                )}
              </Fragment>
            )
          })}
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
