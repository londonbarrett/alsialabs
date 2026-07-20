"use client"

import { Money } from "@/components/common/money"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "@/components/projects/task-status-select"
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
import { useTranslations } from "next-intl"

interface MyTasksListProps {
  tasks: MyTask[]
  isPending: boolean
  getTaskAllowedStatuses: (task: MyTask) => readonly string[] | null
  onStatusChange: (taskId: string, projectId: string, status: string) => void
}

export function MyTasksList({
  tasks,
  isPending,
  getTaskAllowedStatuses,
  onStatusChange,
}: MyTasksListProps) {
  const t = useTranslations()

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
                    {t("myTasks.project")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("myTasks.statusLabel")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("myTasks.cost")}
                  </TableHead>
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
                              onStatusChange(
                                task.id,
                                task.projectId,
                                v
                              )
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
