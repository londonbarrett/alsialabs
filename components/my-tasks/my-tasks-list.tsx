"use client"

import { Money } from "@/components/common/money"
import { DueDate } from "@/components/projects/due-date"
import { TaskCommentsPanel } from "@/components/projects/task-comments-panel"
import { taskPriorityColors } from "@/components/projects/task-priority-select"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "@/components/projects/task-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MyTask } from "@/lib/actions/tasks"
import { isTaskOverdue } from "@/lib/utils"
import { MessageSquare, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

interface MyTasksListProps {
  tasks: MyTask[]
  isPending: boolean
  currentUserId: string
  isSuperUser: boolean
  getTaskAllowedStatuses: (task: MyTask) => readonly string[] | null
  onStatusChange: (
    taskId: string,
    projectId: string,
    status: string
  ) => void
  onCommentCountChange?: (taskId: string, delta: number) => void
}

export function MyTasksList({
  tasks,
  isPending,
  currentUserId,
  isSuperUser,
  getTaskAllowedStatuses,
  onStatusChange,
  onCommentCountChange,
}: MyTasksListProps) {
  const t = useTranslations()
  const [commentsTask, setCommentsTask] = useState<MyTask | undefined>()

  return (
    <Card>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isPending ? t("common.loading") : t("myTasks.noTasks")}
          </p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">
                    {t("myTasks.taskName")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("myTasks.project")} ({t("myTasks.owner")})
                  </TableHead>
                  <TableHead scope="col">
                    {t("myTasks.statusLabel")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("projects.tasks.priorityLabel")}
                  </TableHead>
                  <TableHead scope="col">{t("myTasks.cost")}</TableHead>
                  <TableHead scope="col">
                    {t("projects.tasks.dueDate")}
                  </TableHead>
                  <TableHead scope="col" className="w-12" />
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
                        <div className="flex items-center gap-2">
                          <p>{task.name}</p>
                          {task.routineId && (
                            <Badge
                              variant="outline"
                              className="gap-1 text-xs"
                            >
                              <RefreshCw className="h-3 w-3" />
                              {t("projects.routines.routine")}
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {task.projectName}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const allowed = getTaskAllowedStatuses(task)
                        if (!allowed) {
                          return (
                            <Badge
                              className={taskStatusColors[task.status]}
                            >
                              {t(
                                `projects.tasks.status.${task.status}`
                              )}
                            </Badge>
                          )
                        }
                        return (
                          <TaskStatusSelect
                            status={task.status}
                            allowedStatuses={allowed}
                            onStatusChange={(v) =>
                              onStatusChange(task.id, task.projectId, v)
                            }
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {task.priority ? (
                        <Badge
                          className={taskPriorityColors[task.priority]}
                        >
                          {t(
                            `projects.tasks.priority.${task.priority}`
                          )}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("projects.tasks.priority.none")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.cost ? (
                        <Money value={task.cost} />
                      ) : (
                        "\u2014"
                      )}
                    </TableCell>
                    <TableCell>
                      <DueDate
                        date={task.dueDate}
                        overdue={isTaskOverdue(task.status, task.dueDate)}
                        overdueLabel={t("projects.tasks.overdue")}
                      />
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {commentsTask && (
        <TaskCommentsPanel
          taskId={commentsTask.id}
          taskName={commentsTask.name}
          description={commentsTask.description}
          open={!!commentsTask}
          onOpenChange={(open) => {
            if (!open) setCommentsTask(undefined)
          }}
          currentUserId={currentUserId}
          isOwner={isSuperUser || commentsTask.isOwner}
          onCommentCountChange={onCommentCountChange}
        />
      )}
    </Card>
  )
}
