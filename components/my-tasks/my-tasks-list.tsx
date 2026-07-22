"use client"

import { Money } from "@/components/common/money"
import { TaskCommentsPanel } from "@/components/projects/task-comments-panel"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "@/components/projects/task-status-select"
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
import type { MyTask } from "@/lib/actions/project-tasks"
import { MessageSquare } from "lucide-react"
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
                  <TableHead scope="col">{t("myTasks.cost")}</TableHead>
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
                        <p>{task.name}</p>
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
                              onStatusChange(task.id, task.projectId, v)
                            }
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {task.cost ? (
                        <Money value={task.cost} />
                      ) : (
                        "\u2014"
                      )}
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
          projectName={commentsTask.projectName}
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
