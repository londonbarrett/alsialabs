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
import { ListTodo, MessageSquare, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { TaskCommentsPanel } from "./task-comments-panel"
import { TaskDialog } from "./task-dialog"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "./task-status-select"

export type ProjectTaskWithCommentCount = ProjectTask & {
  commentCount: number
}

const allTaskStatuses = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const

const collaboratorTaskStatuses = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
] as const

interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

interface ProjectTasksProps {
  initialTasks: ProjectTaskWithCommentCount[]
  projectId: string
  projectName: string
  canEdit: boolean
  isOwner: boolean
  isCollaborator: boolean
  currentUserId: string
  permissions: string[]
  projectMembers: ProjectMember[]
}

export function ProjectTasks({
  initialTasks,
  projectId,
  projectName,
  canEdit,
  isOwner,
  isCollaborator,
  currentUserId,
  permissions,
  projectMembers,
}: ProjectTasksProps) {
  const router = useRouter()
  const t = useTranslations()
  const [tasks, setTasks] =
    useState<ProjectTaskWithCommentCount[]>(initialTasks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<
    ProjectTask | undefined
  >()
  const [commentsTask, setCommentsTask] = useState<
    ProjectTaskWithCommentCount | undefined
  >()
  const canMutate =
    isOwner && (canEdit || permissions.includes("projects:delete"))

  function getTaskAllowedStatuses(task: ProjectTask) {
    if (isOwner) return allTaskStatuses
    if (task.status === "done") return null
    if (isCollaborator && task.assigneeId === currentUserId)
      return collaboratorTaskStatuses
    return null
  }

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

  function handleCommentCountChange(taskId: string, delta: number) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, commentCount: Math.max(0, t.commentCount + delta) }
          : t
      )
    )
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            {t("projects.tasks.title")}
          </span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t("projects.tasks.addTask")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                  <TableHead scope="col" className="w-12" />
                  {canMutate && (
                    <TableHead scope="col">
                      {t("projects.tasks.actions")}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    onDoubleClick={() => setCommentsTask(task)}
                  >
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
                      {(() => {
                        const allowed = getTaskAllowedStatuses(task)
                        if (!allowed) {
                          return (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${taskStatusColors[task.status]}`}
                            >
                              {t(
                                `projects.tasks.status.${task.status}`
                              )}
                            </span>
                          )
                        }
                        return (
                          <TaskStatusSelect
                            status={task.status}
                            allowedStatuses={allowed}
                            onStatusChange={(v) =>
                              handleTaskStatusChange(task.id, v)
                            }
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {task.cost ? <Money value={task.cost} /> : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        onClick={() => setCommentsTask(task)}
                        className="gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs text-muted-foreground">
                          {task.commentCount}
                        </span>
                      </Button>
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
      </CardContent>

      <TaskDialog
        task={editingTask}
        projectId={projectId}
        projectMembers={projectMembers}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />

      {commentsTask && (
        <TaskCommentsPanel
          taskId={commentsTask.id}
          taskName={commentsTask.name}
          projectName={projectName}
          description={commentsTask.description}
          open={!!commentsTask}
          onOpenChange={(open) => {
            if (!open) setCommentsTask(undefined)
          }}
          currentUserId={currentUserId}
          isOwner={isOwner}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </Card>
  )
}
