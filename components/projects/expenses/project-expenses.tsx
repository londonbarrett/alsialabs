"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
import { Badge } from "@/components/ui/badge"
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
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  deleteExpense,
  type ExpenseWithCategory,
} from "@/lib/actions/expenses"
import { deleteTask, upsertTask } from "@/lib/actions/tasks"
import type { Task } from "@/lib/drizzle/schema"
import type { ProjectMember } from "@/lib/types"
import { cn } from "@/lib/util/utils"
import { Plus, Receipt, Wallet } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useReducer, useState, useTransition } from "react"
import { toast } from "sonner"
import { TaskDialog } from "../task-dialog"
import { ExpenseDialog } from "./expense-dialog"

type TaskAction =
  | { type: "add"; task: Task }
  | { type: "update"; task: Task }
  | { type: "replaceTemp"; tempId: string; task: Task }
  | { type: "delete"; taskId: string }
  | { type: "reset"; tasks: Task[] }

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// TODO: Move reducer to separate file
function taskReducer(state: Task[], action: TaskAction): Task[] {
  switch (action.type) {
    case "add":
      return [action.task, ...state]
    case "update":
      return state.map((t) =>
        t.id === action.task.id ? action.task : t
      )
    case "replaceTemp":
      return state.map((t) =>
        t.id === action.tempId ? action.task : t
      )
    case "delete":
      return state.filter((t) => t.id !== action.taskId)
    case "reset":
      return action.tasks
  }
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
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [localTasks, dispatch] = useReducer(taskReducer, tasks)
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<
    ExpenseWithCategory | undefined
  >()
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  function handleSuccess() {
    router.refresh()
    setEditingExpense(undefined)
    setEditingTask(undefined)
  }

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
    const taskStatus = data.status as
      | "todo"
      | "in_progress"
      | "in_review"
      | "blocked"
      | "done"
    const taskPriority = data.priority as "urgent" | "high" | null

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
    const result = await upsertTask(
      { ...data, status: taskStatus, priority: taskPriority },
      projectId,
      editingTask?.id
    )
    stopLoading()

    if (result.success && result.data) {
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
      toast.error(result.error || t("common.somethingWentWrong"))
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
    const result = await deleteTask(taskId, projectId)
    stopLoading()
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
      startTransition(() => {
        dispatch({ type: "reset", tasks })
      })
    } else {
      toast.success(t("projects.tasks.taskDeleted"))
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    const result = await deleteExpense(expenseId, projectId)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    } else {
      toast.success(t("projects.expenses.expenseDeleted"))
    }
  }

  const taskCosts = localTasks.filter(
    (t) => t.cost && Number(t.cost) > 0
  )
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
                            {t.has(
                              `categoryNames.${row.expense.categorySlug}`
                            )
                              ? t(
                                  `categoryNames.${row.expense.categorySlug}`
                                )
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
                                      ? openEditTask(row.task)
                                      : openEdit(row.expense)
                                : undefined
                            }
                            onDelete={() =>
                              row.type === "task"
                                ? handleDeleteTask(row.task.id)
                                : handleDeleteExpense(row.expense.id)
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
        projectMembers={projectMembers}
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        onSubmit={handleTaskSubmit}
      />
    </Card>
  )
}
