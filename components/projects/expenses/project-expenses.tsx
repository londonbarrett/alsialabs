"use client"

import { Money } from "@/components/common/money"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/lib/actions/expenses"
import { createTask, deleteTask, updateTask } from "@/lib/actions/tasks"
import { useActionError } from "@/lib/util/action-errors"
import type {
  Expense,
  Task,
  TaskPriority,
  TaskStatus,
} from "@/lib/drizzle/schema"
import type { ExpenseWithCategory, ProjectMember } from "@/lib/types"
import { cn } from "@/lib/util/utils"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useAction } from "next-safe-action/hooks"
import { useReducer, useState, useTransition } from "react"
import { toast } from "sonner"
import { TaskDialog } from "../task-dialog"
import { ExpenseDialog } from "./expense-dialog"
import { ExpensesTable } from "./expenses-table"
import { expenseReducer } from "@/reducers/expense-reducer"
import { taskReducer } from "@/reducers/task-reducer"

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface ProjectExpensesProps {
  expenses: ExpenseWithCategory[]
  tasks: Task[]
  projectId: string
  budget: string | null
  categories: { id: string; slug: string; name: string }[]
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
  const translateError = useActionError()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [localTasks, dispatch] = useReducer(taskReducer, tasks)
  const [optimisticExpenses, dispatchExpenses] = useReducer(
    expenseReducer,
    expenses
  )
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<
    ExpenseWithCategory | undefined
  >()
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  const { executeAsync: executeCreateExpense } =
    useAction(createExpense)
  const { executeAsync: executeUpdateExpense } =
    useAction(updateExpense)
  const { executeAsync: executeDeleteExpense } =
    useAction(deleteExpense)
  const { executeAsync: executeCreateTask } = useAction(createTask)
  const { executeAsync: executeUpdateTask } = useAction(updateTask)
  const { executeAsync: executeDeleteTask } = useAction(deleteTask)

  async function handleTaskSubmit(data: {
    name: string
    description: string
    cost: string
    status: string
    priority: string | null
    dueDate: string | null
    assigneeId: string | null
  }) {
    const isEdit = !!editingTask
    setEditingTask(undefined)
    setTaskDialogOpen(false)
    const taskStatus = data.status as TaskStatus
    const taskPriority = data.priority as TaskPriority

    const optimisticTask: Task = {
      id: editingTask?.id ?? `temp-${Date.now()}`,
      projectId,
      name: data.name,
      description: data.description || null,
      cost: data.cost || null,
      status: taskStatus,
      priority: taskPriority,
      routineId: null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      assigneeId: data.assigneeId,
      createdAt: editingTask?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }

    dispatch({ type: isEdit ? "update" : "add", task: optimisticTask })

    startLoading()
    const result = isEdit
      ? await executeUpdateTask({
          projectId,
          taskId: editingTask!.id,
          name: data.name,
          description: data.description,
          cost: data.cost,
          status: taskStatus,
          priority: taskPriority,
          dueDate: data.dueDate,
          assigneeId: data.assigneeId,
        })
      : await executeCreateTask({
          projectId,
          name: data.name,
          description: data.description,
          cost: data.cost,
          status: taskStatus,
          priority: taskPriority,
          dueDate: data.dueDate,
          assigneeId: data.assigneeId,
        })
    stopLoading()

    if (result?.data) {
      startTransition(() => {
        dispatch({
          type: "replaceTemp",
          tempId: optimisticTask.id,
          task: result.data!,
        })
      })
      toast.success(
        isEdit
          ? t("projects.tasks.taskUpdated")
          : t("projects.tasks.taskCreated")
      )
    } else {
      if (!isEdit) {
        startTransition(() => {
          dispatch({ type: "delete", taskId: optimisticTask.id })
        })
      }
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
      } else {
        toast.error(t("common.somethingWentWrong"))
      }
    }

    return result
  }

  function openNew() {
    setEditingExpense(undefined)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseWithCategory) {
    setEditingExpense(expense)
    setDialogOpen(true)
  }

  function openEditTask(task: Task) {
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
    dispatch({ type: "delete", taskId })
    startLoading()
    const result = await executeDeleteTask({ projectId, taskId })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      startTransition(() => {
        dispatch({ type: "reset", tasks })
      })
    } else {
      toast.success(t("projects.tasks.taskDeleted"))
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    dispatchExpenses({ type: "delete", expenseId })
    startLoading()
    const result = await executeDeleteExpense({
      projectId,
      id: expenseId,
    })
    stopLoading()
    if (result?.serverError) {
      toast.error(translateError(result.serverError.code))
      dispatchExpenses({ type: "reset", expenses })
      router.refresh()
    } else {
      toast.success(t("projects.expenses.expenseDeleted"))
    }
  }

  async function handleExpenseSubmit(data: Expense) {
    const isEdit = !!editingExpense
    const tempId = editingExpense?.id ?? `temp-${Date.now()}`
    const cat = categories.find((c) => c.id === data.categoryId)

    const optimisticExpense: ExpenseWithCategory = {
      id: data.id || tempId,
      projectId: data.projectId,
      categoryId: data.categoryId,
      description: data.description,
      amount: data.amount,
      expenseDate: data.expenseDate,
      createdAt: editingExpense?.createdAt ?? new Date(),
      updatedAt: new Date(),
      categoryName: cat?.name ?? null,
      categorySlug: cat?.slug ?? null,
    }

    dispatchExpenses({
      type: isEdit ? "update" : "add",
      expense: optimisticExpense,
    })

    const canonical: ExpenseWithCategory = {
      ...optimisticExpense,
      categoryName: cat?.name ?? null,
      categorySlug: cat?.slug ?? null,
    }

    if (isEdit) {
      startLoading()
      const result = await executeUpdateExpense({
        ...data,
        projectId: data.projectId,
        id: editingExpense!.id,
      })
      stopLoading()
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
        dispatchExpenses({ type: "reset", expenses })
        router.refresh()
        return
      }
      dispatchExpenses({
        type: "replaceTemp",
        tempId,
        expense: { ...canonical, id: result.data?.id ?? tempId },
      })
      toast.success(t("projects.expenses.expenseUpdated"))
    } else {
      startLoading()
      const result = await executeCreateExpense({
        ...data,
        projectId: data.projectId,
      })
      stopLoading()
      if (result?.serverError) {
        toast.error(translateError(result.serverError.code))
        dispatchExpenses({ type: "delete", expenseId: tempId })
        router.refresh()
        return
      }
      dispatchExpenses({
        type: "replaceTemp",
        tempId,
        expense: { ...canonical, id: result.data?.id ?? tempId },
      })
      toast.success(t("projects.expenses.expenseCreated"))
    }
  }

  const taskCosts = localTasks.filter(
    (t) => t.cost && Number(t.cost) > 0
  )
  const expenseTotal = optimisticExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  )
  const taskCostTotal = taskCosts.reduce(
    (sum, t) => sum + Number(t.cost),
    0
  )
  const total = expenseTotal + taskCostTotal
  const hasItems = optimisticExpenses.length > 0 || taskCosts.length > 0
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
    ...optimisticExpenses.map((expense) => ({
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
        expense={editingExpense}
        projectId={projectId}
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
        projectMembers={projectMembers}
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        onSubmit={handleTaskSubmit}
      />
    </Card>
  )
}
