import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  executeAsync: vi.fn(),
  pend: vi.fn<(action: unknown) => number>(() => 7),
  commit: vi.fn(),
  discard: vi.fn(),
  settle: vi.fn(),
  /** The store's tasks, so a test can seed the rows a lookup reads. */
  tasks: [] as TaskWithAssignmentsDTO[],
}))

// The hook is exercised directly (no Testing Library in this repo), so every
// React/Next boundary it touches is replaced with a plain stand-in. The store
// deliberately holds NO assignment: fetched history-panel rows are not store
// rows, and recosting one must still reach the action.
vi.mock("react", () => ({ useCallback: (fn: unknown) => fn }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/hooks/use-settle", () => ({ useSettle: () => mocks.settle }))
vi.mock("@/stores/project-tasks/project-tasks-store", () => ({
  useProjectTasksStore: () => ({
    getState: () => ({
      optimistic: { tasks: mocks.tasks, commentsByTask: {} },
      pend: mocks.pend,
      commit: mocks.commit,
      discard: mocks.discard,
    }),
  }),
}))
vi.mock("next-safe-action/hooks", () => ({
  useAction: () => ({ executeAsync: mocks.executeAsync }),
}))
vi.mock("@/stores/use-optimistic-action", () => ({
  useOptimisticAction: () => ({
    run: async (
      action: unknown,
      execute: () => Promise<unknown>,
      options?: {
        commitAction?: (result: { data?: { cost?: string } }) => unknown
      }
    ) => {
      const id = mocks.pend(action)
      const result = await execute()
      const override =
        typeof options?.commitAction === "function"
          ? options.commitAction(result as { data?: { cost?: string } })
          : options?.commitAction
      mocks.commit(id, override)
      return result
    },
  }),
}))
vi.mock("@/actions/tasks", () => ({
  archiveTask: vi.fn(),
  createComment: vi.fn(),
  createTask: vi.fn(),
  deleteComment: vi.fn(),
  deleteTask: vi.fn(),
  getTaskAssignmentHistory: vi.fn(),
  getTaskComments: vi.fn(),
  unarchiveTask: vi.fn(),
  updateAssignmentCost: vi.fn(),
  updateAssignmentComment: vi.fn(),
  updateAssignmentStatus: vi.fn(),
  updateComment: vi.fn(),
  updateTask: vi.fn(),
  updateTaskPriority: vi.fn(),
}))

import { useProjectTasksActions as getProjectTasksActions } from "./use-project-tasks-actions"

function makeAssignment(
  overrides: Partial<TaskAssignmentDTO> = {}
): TaskAssignmentDTO {
  return {
    id: "a-1",
    taskId: "task-1",
    userId: "user-1",
    userName: "Ada",
    userEmail: "ada@test.local",
    userImage: null,
    status: "todo",
    comment: null,
    cost: "100",
    startDate: null,
    endDate: null,
    timeZone: "America/Bogota",
    startTime: null,
    ...overrides,
  }
}

function makeTask(
  overrides: Partial<TaskWithAssignmentsDTO> = {}
): TaskWithAssignmentsDTO {
  return {
    id: "task-1",
    projectId: "project-1",
    name: "Fix the roof",
    description: null,
    priority: null,
    cost: "0",
    startDate: null,
    endDate: null,
    recurrence: null,
    interval: 1,
    daysOfWeek: null,
    startTime: null,
    endTime: null,
    archived: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    commentCount: 0,
    closedCount: 0,
    totalCost: 0,
    overdue: false,
    assignments: [makeAssignment()],
    assigneeIds: ["user-1"],
    ...overrides,
  } satisfies TaskWithAssignmentsDTO
}

describe("useProjectTasksActions().updateAssignmentCost", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No store rows: the assignment being recosted is a fetched one.
    mocks.tasks = []
  })

  it("pends, persists and settles when the assignment is not in the store", async () => {
    mocks.executeAsync.mockResolvedValue({ data: { cost: "150.00" } })

    const actions = getProjectTasksActions()
    await actions.updateAssignmentCost(
      "project-1",
      "task-1",
      "fetched-history-row",
      "150",
      "100"
    )

    expect(mocks.pend).toHaveBeenCalledWith({
      type: "setAssignmentCost",
      taskId: "task-1",
      assignmentId: "fetched-history-row",
      cost: "150",
      costDelta: 50,
    })
    expect(mocks.executeAsync).toHaveBeenCalledWith({
      projectId: "project-1",
      assignmentId: "fetched-history-row",
      cost: "150",
    })
    expect(mocks.commit).toHaveBeenCalledWith(7, {
      type: "setAssignmentCost",
      taskId: "task-1",
      assignmentId: "fetched-history-row",
      cost: "150.00",
      costDelta: 0,
    })
    expect(mocks.settle).toHaveBeenCalled()
  })

  it("loads history with an explicit page size for the expenses tab", async () => {
    mocks.executeAsync.mockResolvedValue({
      data: { assignments: [], hasMore: false },
    })

    const actions = getProjectTasksActions()
    await actions.loadAssignmentHistory("project-1", "task-1", 0, 30)

    expect(mocks.executeAsync).toHaveBeenCalledWith({
      projectId: "project-1",
      taskId: "task-1",
      limit: 30,
      offset: 0,
    })
  })

  it("treats an absent previousCost as zero", async () => {
    mocks.executeAsync.mockResolvedValue({ data: { cost: "80" } })

    const actions = getProjectTasksActions()
    await actions.updateAssignmentCost(
      "project-1",
      "task-1",
      "fetched-history-row",
      "80"
    )

    expect(mocks.pend).toHaveBeenCalledWith(
      expect.objectContaining({ cost: "80", costDelta: 80 })
    )
  })
})

describe("useProjectTasksActions() closed-only cost deltas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tasks = [makeTask()]
  })

  it("an open assignment cost edit does not move totalCost", async () => {
    mocks.executeAsync.mockResolvedValue({ data: { cost: "150.00" } })

    const actions = getProjectTasksActions()
    await actions.updateAssignmentCost(
      "project-1",
      "task-1",
      "a-1",
      "150",
      "100",
      false
    )

    // The row is still open: its cost is stored, but it is not money yet.
    expect(mocks.pend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setAssignmentCost",
        cost: "150",
        costDelta: 0,
      })
    )
  })

  it("closing an assignment adds its cost and reopening subtracts it", async () => {
    mocks.executeAsync.mockResolvedValue({
      data: {
        assignment: makeAssignment({ status: "done" }),
        nextAssignment: null,
        spawnedCostTotal: 0,
      },
    })

    const actions = getProjectTasksActions()
    await actions.updateAssignmentStatus("project-1", "task-1", "a-1", "done")

    expect(mocks.pend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertAssignment",
        costDelta: 100,
      })
    )

    mocks.pend.mockClear()
    mocks.tasks = [makeTask({ assignments: [makeAssignment({ status: "done" })] })]

    await actions.updateAssignmentStatus("project-1", "task-1", "a-1", "todo")

    expect(mocks.pend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertAssignment",
        costDelta: -100,
      })
    )
  })

  it("unarchive does not add spawned open-row cost", async () => {
    mocks.executeAsync.mockResolvedValue({
      data: { spawned: [makeAssignment({ id: "spawned-1" })] },
    })

    const actions = getProjectTasksActions()
    await actions.unarchiveTask("project-1", "task-1")

    expect(mocks.commit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ type: "setArchived", costDelta: 0 })
    )
  })
})
