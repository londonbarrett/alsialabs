"use client"

import type { MyAssignmentDTO, TaskStatus } from "@/actions/schemas/task"
import { DueDate } from "@/components/projects/due-date"
import { taskPriorityColors } from "@/components/projects/task-priority-select"
import {
  TaskStatusSelect,
  taskStatusColors,
} from "@/components/projects/task-status-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isTaskOverdue } from "@/lib/util/tasks"
import { MessageSquare } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { MyTaskCommentsPanel } from "./my-task-comments-panel"

interface MyTasksListProps {
  /** The tab strip lives in the header so it labels the table it switches. */
  header: React.ReactNode
  emptyLabel: string
  assignments: MyAssignmentDTO[]
  statuses: Record<string, readonly TaskStatus[] | null>
  isPending: boolean
  currentUserId: string
  readOnly?: boolean
  onStatusChange?: (
    projectId: string,
    assignmentId: string,
    status: TaskStatus
  ) => void
}

export function MyTasksList({
  header,
  emptyLabel,
  assignments,
  statuses,
  isPending,
  currentUserId,
  readOnly = false,
  onStatusChange,
}: MyTasksListProps) {
  const t = useTranslations()
  const [commentsAssignment, setCommentsAssignment] = useState<
    MyAssignmentDTO | undefined
  >()
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {header}
        </div>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isPending ? t("common.loading") : emptyLabel}
          </p>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("common.task")}</TableHead>
                  <TableHead scope="col">
                    {t("common.project")} ({t("common.owner")})
                  </TableHead>
                  <TableHead scope="col">
                    {t("common.status")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("common.priority")}
                  </TableHead>
                  <TableHead scope="col">
                    {t("common.dueDate")}
                  </TableHead>
                  <TableHead scope="col" className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => {
                  const allowed = readOnly
                    ? null
                    : statuses[assignment.assignmentId] ?? null
                  return (
                    <TableRow
                      key={assignment.assignmentId}
                      onDoubleClick={() => {
                        if (readOnly) return
                        setCommentsAssignment(assignment)
                        setIsCommentsOpen(true)
                      }}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p>{assignment.name}</p>
                          {assignment.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {assignment.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {assignment.projectName}
                          {assignment.projectOwnerName
                            ? ` (${assignment.projectOwnerName})`
                            : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        {allowed ? (
                          <TaskStatusSelect
                            status={assignment.status}
                            allowedStatuses={allowed}
                            onStatusChange={(value) =>
                              onStatusChange?.(
                                assignment.projectId,
                                assignment.assignmentId,
                                value
                              )
                            }
                          />
                        ) : (
                          <Badge
                            className={taskStatusColors[assignment.status]}
                          >
                            {t(
                              `projects.tasks.status.${assignment.status}`
                            )}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {assignment.priority ? (
                          <Badge
                            className={
                              taskPriorityColors[assignment.priority]
                            }
                          >
                            {t(
                              `projects.tasks.priority.${assignment.priority}`
                            )}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {t("projects.tasks.priority.none")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DueDate
                          date={assignment.endDate}
                          overdue={isTaskOverdue(
                            assignment.status,
                            assignment.endDate
                          )}
                          overdueLabel={t("common.overdue")}
                        />
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-4 w-4" />
                            {assignment.commentCount}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setCommentsAssignment(assignment)
                              setIsCommentsOpen(true)
                            }}
                            className="gap-1.5"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-xs text-muted-foreground">
                              {assignment.commentCount}
                            </span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {!readOnly && (
        <MyTaskCommentsPanel
          key={commentsAssignment?.assignmentId ?? "empty"}
          projectId={commentsAssignment?.projectId ?? ""}
          taskId={commentsAssignment?.taskId ?? ""}
          taskName={commentsAssignment?.name ?? ""}
          description={commentsAssignment?.description}
          open={isCommentsOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsCommentsOpen(false)
              setTimeout(
                () => setCommentsAssignment(undefined),
                300
              )
            }
          }}
          currentUserId={currentUserId}
          canModerate={
            commentsAssignment?.role === "owner" ||
            commentsAssignment?.role === "admin"
          }
        />
      )}
    </Card>
  )
}
