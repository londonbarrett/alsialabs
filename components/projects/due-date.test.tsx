import type { MyAssignmentDTO } from "@/actions/tasks/schemas"
import { MyTasksList } from "@/components/my-tasks/my-tasks-list"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DueDate } from "./due-date"

// DueDate and MyTasksList are client components; a static render supplies the
// next-intl hooks so the labels stay deterministic without a Next request.
const nextIntl = vi.hoisted(() => ({ locale: "es-ES" }))

vi.mock("next-intl", () => ({
  useLocale: () => nextIntl.locale,
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    const messages: Record<string, string> = {
      "common.timeZone": "Time zone",
      "common.task": "Task",
      "common.project": "Project",
      "common.owner": "Owner",
      "common.status": "Status",
      "common.priority": "Priority",
      "common.dueDate": "Due date",
      "common.cost": "Cost",
      "common.comments": "Comments",
      "common.loading": "Loading...",
      "common.overdue": "Overdue",
      "common.unassigned": "Unassigned",
      "projects.tasks.recurring": "Recurring",
      "projects.tasks.status.todo": "To do",
      "projects.tasks.priority.none": "None",
    }
    const template = messages[key] ?? key
    return values
      ? template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")
      : template
  },
}))

vi.mock("@/components/my-tasks/my-task-comments-panel", () => ({
  MyTaskCommentsPanel: () => null,
}))

const bogotaInstant = new Date("2026-11-25T02:00:00Z")

describe("DueDate", () => {
  beforeEach(() => {
    nextIntl.locale = "es-ES"
  })

  it("renders the project-zone date for an instant that is the next day in UTC", () => {
    const markup = renderToStaticMarkup(
      <DueDate
        date={bogotaInstant}
        timeZone="America/Bogota"
        startTime={null}
      />
    )

    expect(markup).toContain("24 nov")
    expect(markup).not.toContain("25 nov")
    expect(markup).not.toContain("America/Bogota")
  })

  it("renders an all-day date without an hour whatever the stored instant", () => {
    const markup = renderToStaticMarkup(
      <DueDate
        date={new Date("2026-11-20T14:00:00Z")}
        timeZone="America/Bogota"
        startTime={null}
      />
    )

    expect(markup).toContain("20 nov")
    expect(markup).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it("keeps the project-zone time for timed work", () => {
    const markup = renderToStaticMarkup(
      <DueDate
        date={new Date("2026-11-20T22:00:00Z")}
        timeZone="America/Bogota"
        startTime="17:00"
      />
    )

    expect(markup).toContain("17:00")
  })
})

const assignmentRow = (overrides: Partial<MyAssignmentDTO>): MyAssignmentDTO => ({
  assignmentId: "a1",
  taskId: "t1",
  projectId: "p1",
  name: "Task",
  description: null,
  priority: null,
  projectName: "Project",
  projectColor: "blue",
  projectOwnerName: null,
  role: "collaborator",
  status: "todo",
  comment: null,
  cost: "0",
  startDate: new Date("2026-11-24T05:00:00Z"),
  endDate: bogotaInstant,
  timeZone: "America/Bogota",
  startTime: null,
  recurrence: null,
  commentCount: 0,
  overdue: false,
  ...overrides,
})

describe("MyTasksList dates", () => {
  beforeEach(() => {
    nextIntl.locale = "es-ES"
  })

  it("formats each row in its own project zone", () => {
    const markup = renderToStaticMarkup(
      <MyTasksList
        header={<span>Tasks</span>}
        emptyLabel="No tasks"
        assignments={[
          assignmentRow({ assignmentId: "bogota", name: "Bogotá task" }),
          assignmentRow({
            assignmentId: "madrid",
            name: "Madrid task",
            projectId: "p2",
            projectName: "Madrid project",
            timeZone: "Europe/Madrid",
          }),
        ]}
        statuses={{}}
        isPending={false}
        currentUserId="u1"
        readOnly
      />
    )

    expect(markup).toContain("24 nov")
    expect(markup).toContain("25 nov")
    expect(markup).not.toContain("America/Bogota")
    expect(markup).not.toContain("Europe/Madrid")
  })

  it("shows the performance note under the task name and no editing affordance", () => {
    const markup = renderToStaticMarkup(
      <MyTasksList
        header={<span>Tasks</span>}
        emptyLabel="No tasks"
        assignments={[assignmentRow({ comment: "Delivered early" })]}
        statuses={{}}
        isPending={false}
        currentUserId="u1"
        readOnly
      />
    )

    expect(markup).toContain("Delivered early")
    // The note is plain data: no note input, no Save button, no input at all
    // in the read-only surface.
    expect(markup).not.toContain("Comentario de desempeño")
    expect(markup).not.toContain("performanceComment")
    expect(markup).not.toContain("<input")
  })

  it("shows no note element when the comment is null", () => {
    const markup = renderToStaticMarkup(
      <MyTasksList
        header={<span>Tasks</span>}
        emptyLabel="No tasks"
        assignments={[assignmentRow({ comment: null })]}
        statuses={{}}
        isPending={false}
        currentUserId="u1"
        readOnly
      />
    )

    expect(markup).not.toContain("Delivered early")
  })
})
