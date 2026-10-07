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
import type {
  Expense,
  TaskPriority,
  TaskStatus,
} from "@/lib/drizzle/schema"
import type { ExpenseWithCategory } from "@/lib/types"
import { useExpensesActions } from "@/stores/expenses/use-expenses-actions"
import { useExpensesState } from "@/stores/expenses/use-expenses-state"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import type { TaskWithCommentCount } from "@/stores/project-tasks/project-tasks-reducer"
import { useProjectTasksActions } from "@/stores/project-tasks/use-project-tasks-actions"
import { useProjectTasksState } from "@/stores/project-tasks/use-project-tasks-state"
import { cn } from "cn"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { TaskDialog, type TaskFormValues } from "../task-dialog"
import { ExpenseDialog } from "./expense-dialog"
import { ExpensesTable } from "./expenses-table"

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface ProjectExpensesProps {
  categories: { id: string; slug: string; name: string }[]
}

export function ProjectExpenses({ categories }: ProjectExpensesProps) {
  const t = useTranslations()
  const {
    project,
    projectId,
    members,
    isOwner,
    isPrimaryOwner,
    isCurrentUserAdmin,
  } = useProjectContextState()
  const budget = project.budget ?? null
  const canEditProject = useHasPermission("projects:edit")
  const canEdit =
    useHasPermission("expenses:create") || (isOwner && canEditProject)
  const canDeleteExpense = useHasPermission("expenses:delete")
  const canDelete =
    canDeleteExpense || isPrimaryOwner || isCurrentUserAdmin

  const { expenses } = useExpensesState()
  const { saveExpense, deleteExpense } = useExpensesActions()
  const { tasks } = useProjectTasksState()
  const { saveTask, deleteTask } = useProjectTasksActions()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<
    ExpenseWithCategory | undefined
  >()
  const [editingTask, setEditingTask] = useState<
    TaskWithCommentCount | undefined
  >()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  async function handleTaskSubmit(data: TaskFormValues) {
    setEditingTask(undefined)
    setTaskDialogOpen(false)
    const taskStatus = data.status as TaskStatus
    const taskPriority = data.priority as TaskPriority

    const optimisticTask: TaskWithCommentCount = {
      id: editingTask?.id ?? `temp-${Date.now()}`,
      projectId,
      name: data.name,
      description: data.description || null,
      cost: data.cost || null,
      status: taskStatus,
      priority: taskPriority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      routineId: editingTask?.routineId ?? null,
      assigneeId: data.assigneeId,
      assigneeName:
        members.find((m) => m.userId === data.assigneeId)?.userName ??
        editingTask?.assigneeName ??
        null,
      commentCount: editingTask
        ? (tasks.find((t) => t.id === editingTask.id)?.commentCount ??
          0)
        : 0,
      createdAt: editingTask?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    await saveTask({
      projectId,
      values: data,
      optimisticTask,
      editingTaskId: editingTask?.id ?? null,
    })
  }

  function openNew() {
    setEditingExpense(undefined)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseWithCategory) {
    setEditingExpense(expense)
    setDialogOpen(true)
  }

  function openEditTask(task: TaskWithCommentCount) {
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

  async function handleDeleteTask(taskId: string) {
    await deleteTask(projectId, taskId)
  }

  async function handleDeleteExpense(expenseId: string) {
    await deleteExpense({ projectId, expenseId })
  }

  async function handleExpenseSubmit(data: Expense) {
    await saveExpense({ data, categories, editingExpense })
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

  const rows = [
    ...taskCosts.map((task) => ({
      key: `task-${task.id}`,
      type: "task" as const,
      task,
      date: task.createdAt
        ? formatDate(new Date(task.createdAt))
        : "9999-12-31",
    })),
    ...expenses.map((expense) => ({
      key: expense.id,
      type: "expense" as const,
      expense,
      date: expense.expenseDate,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

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
              onEditTask={openEditTask}
              onDeleteExpense={handleDeleteExpense}
              onDeleteTask={handleDeleteTask}
            />
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
        projectId={projectId}
        expense={editingExpense}
        categories={categories}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSubmit={(data) => {
          setDialogOpen(false)
          setEditingExpense(undefined)
          void handleExpenseSubmit(data)
        }}
      />

      <TaskDialog
        task={editingTask}
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        onSubmit={handleTaskSubmit}
      />
    </Card>
  )
}
