"use client"

import type {
  TaskPriorityDTO,
  TaskStatus,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { ActionMenu } from "@/components/common/action-menu"
import { Money } from "@/components/common/money"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { MenuAction } from "@/lib/types"
import { sortAssignments } from "@/lib/tasks/assignments"
import { isOpenAssignment } from "@/lib/tasks/filter"
import {
  assigneeIdentities,
  visibleAssignments,
} from "@/lib/tasks/list"
import { isTerminalStatus } from "@/lib/util/project-roles"
import { useProjectContextState } from "@/stores/project-context/use-project-context-state"
import { ChevronRight, MessageSquare, RefreshCw } from "lucide-react"
import { useTranslations } from "next-intl"
import { Fragment, useCallback, useState } from "react"
import { cn } from "cn"
import { DueDate } from "../due-date"
import { TaskArchiveDialog } from "./task-archive-dialog"
import { createTaskArchiveAction } from "./task-archive-action"
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
  const { project, isOwner, isAdmin, members } =
    useProjectContextState()
  const canEditProject = useHasPermission("projects:edit")
  const canEdit = (isOwner || isAdmin) && canEditProject
  const canDeleteProject = useHasPermission("projects:delete")
  // Name + five centred columns + Actions; the comments column is gone.
  const columnCount = 7
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(
    null
  )

  const handleArchive = useCallback(
    (taskId: string, closeAs: "done" | "cancelled") => {
      onArchive(taskId, closeAs)
      setArchivingTaskId(null)
    },
    [onArchive]
  )
  const handleDialogArchive = useCallback(
    (closeAs: "done" | "cancelled") => {
      if (archivingTaskId) handleArchive(archivingTaskId, closeAs)
    },
    [archivingTaskId, handleArchive]
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
      {/* Fixed widths keep expanded assignment rows from reflowing the table. */}
      <Table className="min-w-275 table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="w-45">
              {t("projects.tasks.name")}
            </TableHead>
            <TableHead scope="col" className="w-27.5 text-center">
              {t("projects.tasks.assignees")}
            </TableHead>
            <TableHead scope="col" className="w-37.5 text-center">
              {t("common.status")}
            </TableHead>
            <TableHead scope="col" className="w-35 text-center">
              {t("common.priority")}
            </TableHead>
            <TableHead scope="col" className="w-40 text-center">
              {t("common.dueDate")}
            </TableHead>
            <TableHead scope="col" className="w-27.5 text-center">
              {t("projects.tasks.totalCost")}
            </TableHead>
            <TableHead scope="col" className="w-35 text-center">
              {t("common.actions")}
            </TableHead>
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
            const assignees = assigneeIdentities(
              task.assigneeIds,
              shown,
              task.assignments,
              members
            )
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
            const storeTerminal = task.assignments.filter(
              (assignment) => isTerminalStatus(assignment.status)
            )
            const openIds = open.map((assignment) => assignment.id)
            const isExpanded = expanded.has(task.id)
            // Sorted so sortAssignments re-orders can't retrigger the
            // history panel's pagination reset.
            const historySignature = storeTerminal
              .map((assignment) => assignment.id)
              .sort()
              .join(",")
            // A simple summary: open assignments and closed assignments.
            const statusParts = [
              ...(open.length > 0
                ? [
                    t("projects.tasks.openCount", {
                      count: open.length,
                    }),
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
                  className={
                    shown.length > 0 ? "cursor-pointer" : undefined
                  }
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (
                      target.closest(
                        "button, [role='combobox'], input, a"
                      )
                    ) {
                      return
                    }
                    if (shown.length > 0) toggleExpanded(task.id)
                  }}
                  onDoubleClick={() => onComments(task)}
                >
                  <TableCell className="font-medium">
                    <div>
                      <div className="flex items-center gap-2">
                        {shown.length > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0"
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
                        <p className="min-w-0 flex-1 wrap-break-word whitespace-normal">
                          {task.name}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {assignees.length > 0 ? (
                        <TaskAssigneeStack assignees={assignees} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("common.unassigned")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {statusSummary}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {(isOwner || isAdmin) && canEdit ? (
                        <TaskPrioritySelect
                          priority={task.priority}
                          onPriorityChange={(p) =>
                            onPriorityChange(task.id, p)
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {task.priority
                            ? t(
                                `projects.tasks.priority.${task.priority}`
                              )
                            : t("projects.tasks.priority.none")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <DueDate
                        date={task.endDate}
                        timeZone={project.timeZone}
                        startTime={task.startTime}
                        overdue={task.overdue}
                        overdueLabel={t("common.overdue")}
                      />
                      {task.recurrence && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Badge
                                variant="outline"
                                aria-label={t(
                                  "projects.tasks.recurring"
                                )}
                                className="shrink-0"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Badge>
                            }
                          />
                          <TooltipContent>
                            {t("projects.tasks.recurring")}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Money value={task.totalCost} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <ActionMenu
                        entityName={task.name}
                        onEdit={() => onEdit(task)}
                        onDelete={() => onDelete(task.id)}
                        canEdit={canEdit}
                        canDelete={canDeleteProject}
                        actions={[
                          {
                            key: "comments",
                            label: t("common.comments"),
                            icon: MessageSquare,
                            onSelect: () => onComments(task),
                          },
                          createTaskArchiveAction({
                            labels: {
                              archive: t("projects.tasks.archiveTask"),
                              unarchive: t(
                                "projects.tasks.unarchiveTask"
                              ),
                            },
                            task,
                            canArchive: canEdit,
                            onArchiveRequest: () =>
                              setArchivingTaskId(task.id),
                            onArchiveDirect: () =>
                              handleArchive(task.id, "cancelled"),
                            onUnarchive: () => onUnarchive(task.id),
                          }),
                        ].filter(
                          (action): action is MenuAction =>
                            action !== null
                        )}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <Fragment>
                    <TaskOpenAssignmentRows
                      taskId={task.id}
                      assignments={openRows}
                      timeZone={project.timeZone}
                      onStatusChange={onStatusChange}
                      columnCount={columnCount}
                    />
                    {task.recurrence === null && (
                      <TaskClosedAssignmentRows
                        taskId={task.id}
                        assignments={closedRows}
                        timeZone={project.timeZone}
                        onReopen={(assignmentId) =>
                          onStatusChange(task.id, assignmentId, "todo")
                        }
                        columnCount={columnCount}
                      />
                    )}
                    <TaskHistoryPanel
                      taskId={task.id}
                      recurrence={task.recurrence}
                      timeZone={project.timeZone}
                      storeTerminal={storeTerminal}
                      openIds={openIds}
                      historySignature={historySignature}
                      columnCount={columnCount}
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
        onArchive={handleDialogArchive}
        onCancel={handleArchiveCancel}
      />
    </div>
  )
}
