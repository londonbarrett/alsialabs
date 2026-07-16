"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deleteTask,
  updateTaskStatus,
} from "@/lib/actions/project-tasks"
import type { ProjectTask } from "@/lib/drizzle/schema"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { TaskDialog } from "./task-dialog"

const taskStatusColors: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_review:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  blocked:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
}

const allTaskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const

const collaboratorTaskStatuses = ["blocked", "in_review"] as const

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface ProjectTasksProps {
  tasks: ProjectTask[]
  projectId: string
  canEdit: boolean
  isOwner: boolean
  permissions: string[]
  projectMembers: ProjectMember[]
}

export function ProjectTasks({
  tasks,
  projectId,
  canEdit,
  isOwner,
  permissions,
  projectMembers,
}: ProjectTasksProps) {
  const router = useRouter()
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<
    ProjectTask | undefined
  >()
  const canMutate =
    isOwner && (canEdit || permissions.includes("projects:delete"))
  const allowedStatuses = isOwner
    ? allTaskStatuses
    : collaboratorTaskStatuses

  function getAssigneeName(userId: string) {
    const member = projectMembers.find((m) => m.userId === userId)
    return member?.userName || member?.userEmail || userId
  }

  function handleSuccess() {
    router.refresh()
    setEditingTask(undefined)
  }

  function openNew() {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  function openEdit(task: ProjectTask) {
    setEditingTask(task)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingTask(undefined)
  }

  async function handleTaskStatusChange(
    taskId: string,
    status: string
  ) {
    const result = await updateTaskStatus(taskId, projectId, status)
    if (!result.success) {
      toast.error(result.error || t("common.somethingWentWrong"))
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t("projects.tasks.title")}
        </h2>
        {canEdit && (
          <Button onClick={openNew} size="sm">
            <Plus />
            {t("projects.tasks.addTask")}
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("projects.tasks.noTasks")}
        </p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">
                  {t("projects.tasks.name")}
                </TableHead>
                <TableHead scope="col">
                  {t("projects.tasks.assignee")}
                </TableHead>
                <TableHead scope="col">
                  {t("projects.tasks.statusLabel")}
                </TableHead>
                <TableHead scope="col">
                  {t("projects.tasks.cost")}
                </TableHead>
                {canMutate && (
                  <TableHead scope="col">
                    {t("projects.tasks.actions")}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">
                    <div>
                      <p>{task.name}</p>
                      {task.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.assigneeId ? (
                      <span className="text-sm">
                        {getAssigneeName(task.assigneeId)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("projects.tasks.unassigned")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={task.status}
                        onValueChange={(v) =>
                          handleTaskStatusChange(task.id, v)
                        }
                      >
                        <SelectTrigger className="h-7 w-35">
                          <SelectValue>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusColors[task.status]}`}
                            >
                              {t(
                                `projects.tasks.status.${task.status}`
                              )}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {allowedStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusColors[s]}`}
                              >
                                {t(`projects.tasks.status.${s}`)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${taskStatusColors[task.status]}`}
                      >
                        {t(`projects.tasks.status.${task.status}`)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {task.cost ? `$${task.cost}` : "—"}
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <ActionMenu
                        entityName={task.name}
                        onEdit={() => openEdit(task)}
                        onDelete={async () => {
                          const result = await deleteTask(
                            task.id,
                            projectId
                          )
                          if (!result.success)
                            toast.error(
                              result.error ||
                                t("common.somethingWentWrong")
                            )
                          else
                            toast.success(
                              t("projects.tasks.taskDeleted")
                            )
                        }}
                        canEdit={canEdit}
                        canDelete={permissions.includes(
                          "projects:delete"
                        )}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDialog
        task={editingTask}
        projectId={projectId}
        projectMembers={projectMembers}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
