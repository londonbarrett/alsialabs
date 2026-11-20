"use client"

import type {
  TaskPriorityDTO,
  TaskStatus,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { ActionMenu } from "@/components/common/action-menu"
import { useHasPermission } from "@/components/common/permissions-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { sortAssignments } from "@/lib/tasks/assignments"
import {
  assignmentCounts,
  isOpenAssignment,
} from "@/lib/tasks/filter"
import { visibleAssignments } from "@/lib/tasks/list"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { isTaskOverdue } from "@/lib/util/tasks"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { ChevronRight, MessageSquare, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useState } from "react"
import { cn } from "cn"
import { DueDate } from "./due-date"
import { TaskArchiveDialog } from "./task-archive-dialog"
import { TaskArchiveMenuItem } from "./task-archive-menu-item"
import { TaskAssigneeStack } from "./task-assignee-stack"
import { TaskClosedAssignmentRows } from "./task-closed-assignment-rows"
import { TaskHistoryPanel } from "./task-history-panel"
import { TaskOpenAssignmentRows } from "./task-open-assignment-rows"
import { TaskPrioritySelect } from "./task-priority-select"

interface TasksTableProps {
  tasks: TaskWithAssignmentsDTO[]
  onStatusChange: (
    taskId: string,
    assignmentId: string,
    status: TaskStatus
  ) => void
  onPriorityChange: (taskId: string, priority: TaskPriorityDTO) => void
  onDelete: (taskId: string) => Promise<void>
  onEdit: (task: TaskWithAssignmentsDTO) => void
  onArchive: (taskId: string, closeAs: "done" | "cancelled") => void
  onUnarchive: (taskId: string) => void
  onComments: (task: TaskWithAssignmentsDTO) => void
}

export function TasksTable({
  tasks,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onEdit,
  onArchive,
  onUnarchive,
  onComments,
}: TasksTableProps) {
  const t = useTranslations()
  const { isOwner, isAdmin } = useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = (isOwner || isAdmin) && canEditProject
  const canDeleteProject = useHasPermission("projects:delete")
  const canMutate =
    (isOwner || isAdmin) && (canEdit || canDeleteProject)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(
    null
  )

  const handleArchive = useCallback(
    (closeAs: "done" | "cancelled") => {
      if (archivingTaskId) onArchive(archivingTaskId, closeAs)
      setArchivingTaskId(null)
    },
    [archivingTaskId, onArchive]
  )
  const handleArchiveCancel = useCallback(
    () => setArchivingTaskId(null),
    []
  )

  function toggleExpanded(taskId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">
              {t("projects.tasks.name")}
            </TableHead>
            <TableHead scope="col">{t("common.assignee")}</TableHead>
            <TableHead scope="col">{t("common.status")}</TableHead>
            <TableHead scope="col">{t("common.priority")}</TableHead>
            <TableHead scope="col">{t("common.dueDate")}</TableHead>
            <TableHead scope="col" className="w-12" />
            {canMutate && (
              <TableHead scope="col">{t("common.actions")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const open = sortAssignments(
              task.assignments.filter(isOpenAssignment)
            )
            const shown = visibleAssignments(
              task.assignments,
              task.recurrence
            )
            // Rendering split by recurrence: non-repeating tasks hold
            // their full history, so the initial block renders every
            // loaded row (open selects first, then closed badges with
            // Reopen); repeating tasks render only open rows here —
            // the history panel owns all closed display, seeded with
            // the store rows when none is open.
            const openRows = shown.filter(isOpenAssignment)
            const closedRows =
              task.recurrence === null
                ? shown.filter((assignment) =>
                    isTerminalStatus(assignment.status)
                  )
                : []
            // The panel's two views of the store: every terminal row
            // (zero-open scope + open→terminal absorption) and which
            // rows are currently open (the "was open last render" set).
            const storeTerminal = task.assignments.filter((assignment) =>
              isTerminalStatus(assignment.status)
            )
            const openIds = open.map((assignment) => assignment.id)
            const counts = assignmentCounts(task.assignments)
            const lead = open[0]
            const isExpanded = expanded.has(task.id)
            // Sorted so sortAssignments re-orders can't retrigger the
            // history panel's pagination reset.
            const historySignature = storeTerminal
              .map((assignment) => assignment.id)
              .sort()
              .join(",")
            // Open work first (with its blocked/review detail), then
            // the server-counted terminal total — which stands alone
            // when nothing is open. No parts at all means the task has
            // no assignments whatsoever.
            const statusParts = [
              ...(open.length > 0
                ? [
                    t("projects.tasks.openCount", {
                      count: counts.open,
                    }),
                    ...(counts.blocked > 0
                      ? [
                          t("projects.tasks.blockedCount", {
                            count: counts.blocked,
                          }),
                        ]
                      : []),
                    ...(counts.review > 0
                      ? [
                          t("projects.tasks.reviewCount", {
                            count: counts.review,
                          }),
                        ]
                      : []),
                  ]
                : []),
              ...(task.closedCount > 0
                ? [
                    t("projects.tasks.closedCount", {
                      count: task.closedCount,
                    }),
                  ]
                : []),
            ]
            const statusSummary =
              statusParts.length > 0
                ? statusParts.join(" · ")
                : t("common.unassigned")

            return (
              <Fragment key={task.id}>
                <TableRow
                  onDoubleClick={
                    task.archived ? undefined : () => onComments(task)
                  }
                >
                  <TableCell className="font-medium">
                    <div>
                      <div className="flex items-center gap-2">
                        {shown.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t(
                              "projects.tasks.assignmentsToggle"
                            )}
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(task.id)}
                          >
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isExpanded && "rotate-90"
                              )}
                            />
                          </Button>
                        ) : (
                          <span
                            aria-hidden="true"
                            className="size-8 shrink-0"
                          />
                        )}
                        <p>{task.name}</p>
                        {task.recurrence && (
                          <Badge
                            variant="outline"
                            className="gap-1 text-xs"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {t("projects.tasks.recurring")}
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
                    {shown.length > 0 ? (
                      <TaskAssigneeStack assignments={shown} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("common.unassigned")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{statusSummary}</TableCell>
                  <TableCell>
                    {(isOwner || isAdmin) && canEdit && !task.archived ? (
                      <TaskPrioritySelect
                        priority={task.priority}
                        onPriorityChange={(p) =>
                          onPriorityChange(task.id, p)
                        }
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {task.priority
                          ? t(`projects.tasks.priority.${task.priority}`)
                          : t("projects.tasks.priority.none")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DueDate
                      date={lead ? lead.endDate : task.endDate}
                      overdue={
                        lead
                          ? isTaskOverdue(lead.status, lead.endDate)
                          : false
                      }
                      overdueLabel={t("common.overdue")}
                    />
                  </TableCell>
                  <TableCell>
                    {!task.archived && (
                      <Button
                        variant="secondary"
                        onClick={() => onComments(task)}
                        className="gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="text-xs text-muted-foreground">
                          {task.commentCount}
                        </span>
                      </Button>
                    )}
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <ActionMenu
                        entityName={task.name}
                        onEdit={
                          task.archived ? undefined : () => onEdit(task)
                        }
                        onDelete={() => onDelete(task.id)}
                        canEdit={canEdit}
                        canDelete={canDeleteProject}
                      >
                        <TaskArchiveMenuItem
                          task={task}
                          canArchive={canEdit}
                          onArchiveRequest={() =>
                            setArchivingTaskId(task.id)
                          }
                          onUnarchive={() => onUnarchive(task.id)}
                        />
                      </ActionMenu>
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <Fragment>
                    <TaskOpenAssignmentRows
                      taskId={task.id}
                      assignments={openRows}
                      onStatusChange={onStatusChange}
                      readOnly={task.archived}
                    />
                    {task.recurrence === null && (
                      <TaskClosedAssignmentRows
                        taskId={task.id}
                        assignments={closedRows}
                        onReopen={
                          task.archived
                            ? undefined
                            : (assignmentId) =>
                                onStatusChange(
                                  task.id,
                                  assignmentId,
                                  "todo"
                                )
                        }
                      />
                    )}
                    <TaskHistoryPanel
                      taskId={task.id}
                      recurrence={task.recurrence}
                      storeTerminal={storeTerminal}
                      openIds={openIds}
                      historySignature={historySignature}
                    />
                  </Fragment>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
      <TaskArchiveDialog
        open={archivingTaskId !== null}
        onArchive={handleArchive}
        onCancel={handleArchiveCancel}
      />
    </div>
  )
}
