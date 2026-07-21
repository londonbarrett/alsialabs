"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deleteExpense,
  type ExpenseWithCategory,
} from "@/lib/actions/expenses"
import { deleteTask } from "@/lib/actions/project-tasks"
import type { ProjectTask } from "@/lib/drizzle/schema"
import type { ProjectMember } from "@/components/projects/project-detail-view"
import { cn } from "@/lib/utils"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ExpenseDialog } from "./expense-dialog"
import { TaskDialog } from "../task-dialog"

interface ProjectExpensesProps {
  expenses: ExpenseWithCategory[]
  tasks: ProjectTask[]
  projectId: string
  budget: string | null
  categories: { id: string; slug: string }[]
  canEdit: boolean
  canDelete: boolean
  projectMembers: ProjectMember[]
}

export function ProjectExpenses({
  expenses,
  tasks,
  projectId,
  budget,
  categories,
  canEdit,
  canDelete,
  projectMembers,
}: ProjectExpensesProps) {
  const router = useRouter()
  const t = useTranslations()
  const tc = useTranslations("category-names")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<
    ExpenseWithCategory | undefined
  >()
  const [editingTask, setEditingTask] = useState<
    ProjectTask | undefined
  >()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  function handleSuccess() {
    router.refresh()
    setEditingExpense(undefined)
    setEditingTask(undefined)
  }

  function openNew() {
    setEditingExpense(undefined)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseWithCategory) {
    setEditingExpense(expense)
    setDialogOpen(true)
  }

  function openEditTask(task: ProjectTask) {
    setEditingTask(task)
    setTaskDialogOpen(true)
  }

  function handleTaskDialogOpenChange(open: boolean) {
    setTaskDialogOpen(open)
    if (!open) setEditingTask(undefined)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingExpense(undefined)
  }

  const taskCosts = tasks.filter((t) => t.cost && Number(t.cost) > 0)
  const expenseTotal = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  )
  const taskCostTotal = taskCosts.reduce(
    (sum, t) => sum + Number(t.cost),
    0
  )
  const total = expenseTotal + taskCostTotal
  const hasItems = expenses.length > 0 || taskCosts.length > 0
  const budgetNum = budget ? Number(budget) : 0
  const spendPct =
    budgetNum > 0
      ? Math.min(100, Math.round((total / budgetNum) * 100))
      : 0
  const overBudget = budgetNum > 0 && total > budgetNum

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t("projects.expenses.title")}
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
                  {t("projects.card.budget")}
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
                    "[&_[data-slot=progress-indicator]]:bg-red-500"
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
                      <TableHead scope="col">
                        {t("common.actions")}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskCosts.map((task) => (
                    <TableRow key={`task-${task.id}`}>
                      <TableCell className="font-medium">
                        {task.name}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {t("projects.expenses.task")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Money value={task.cost} />
                      </TableCell>
                      <TableCell>
                        {task.createdAt
                          ? new Date(
                              task.createdAt
                            ).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <ActionMenu
                            entityName={task.name}
                            onEdit={
                              canEdit
                                ? () => openEditTask(task)
                                : undefined
                            }
                            onDelete={async () => {
                              const result = await deleteTask(
                                task.id,
                                projectId
                              )
                              if (!result.success) {
                                toast.error(
                                  result.error ||
                                    t("common.somethingWentWrong")
                                )
                              } else {
                                toast.success(
                                  t("projects.tasks.taskDeleted")
                                )
                              }
                            }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        {expense.categorySlug ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                            {tc(expense.categorySlug)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Money value={expense.amount} />
                      </TableCell>
                      <TableCell>{expense.expenseDate}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <ActionMenu
                            entityName={expense.description}
                            onEdit={
                              canEdit
                                ? () => openEdit(expense)
                                : undefined
                            }
                            onDelete={async () => {
                              const result = await deleteExpense(
                                expense.id,
                                projectId
                              )
                              if (!result.success) {
                                toast.error(
                                  result.error ||
                                    t("common.somethingWentWrong")
                                )
                              } else {
                                toast.success(
                                  t("projects.expenses.expenseDeleted")
                                )
                              }
                            }}
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
            <div className="mt-4 flex justify-end">
              <p className="text-sm text-muted-foreground">
                {t("projects.expenses.total")}: <Money value={total} />
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
        expense={editingExpense}
        projectId={projectId}
        categories={categories}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />

      <TaskDialog
        task={editingTask}
        projectId={projectId}
        projectMembers={projectMembers}
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        onSuccess={handleSuccess}
      />
    </Card>
  )
}
