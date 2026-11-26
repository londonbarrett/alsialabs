import type {
  TaskAssignmentDTO,
  TaskWithAssignmentsDTO,
} from "@/actions/tasks/schemas"
import { defaultIsSuccess } from "@/lib/util/action-result"
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
        commitAction?: (result: { data?: TaskAssignmentDTO }) => unknown
      }
    ) => {
      const id = mocks.pend(action)
      const result = await execute()
      if (!defaultIsSuccess(result)) {
        mocks.discard(id)
        return result
      }
      const override =
        typeof options?.commitAction === "function"
          ? options.commitAction(result as { data?: TaskAssignmentDTO })
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
  updateAssignment: vi.fn(),
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

describe("useProjectTasksActions().loadAssignmentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tasks = []
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
})

describe("useProjectTasksActions().updateAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The row being edited can be a fetched history row, absent from the store.
    mocks.tasks = []
  })

  it("pends both fields, calls the action with both fields, and commits the server row", async () => {
    mocks.executeAsync.mockResolvedValue({
      data: makeAssignment({ cost: "150.00", comment: "note" }),
    })
    mocks.settle.mockReturnValue({ success: true })

    const actions = getProjectTasksActions()
    const result = await actions.updateAssignment(
      "project-1",
      "task-1",
      "fetched-history-row",
      "150",
      "note",
      "100"
    )

    expect(mocks.pend).toHaveBeenCalledWith({
      type: "setAssignmentDetails",
      taskId: "task-1",
      assignmentId: "fetched-history-row",
      cost: "150",
      comment: "note",
      costDelta: 50,
    })
    expect(mocks.executeAsync).toHaveBeenCalledWith({
      projectId: "project-1",
      taskId: "task-1",
      assignmentId: "fetched-history-row",
      cost: "150",
      comment: "note",
    })
    expect(mocks.commit).toHaveBeenCalledWith(7, {
      type: "setAssignmentDetails",
      taskId: "task-1",
      assignmentId: "fetched-history-row",
      cost: "150.00",
      comment: "note",
      costDelta: 0,
    })
    expect(mocks.settle).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it("an open-row edit leaves totalCost unchanged", async () => {
    mocks.executeAsync.mockResolvedValue({
      data: makeAssignment({ cost: "150.00", comment: "note" }),
    })
    mocks.settle.mockReturnValue({ success: true })

    const actions = getProjectTasksActions()
    await actions.updateAssignment(
      "project-1",
      "task-1",
      "fetched-history-row",
      "150",
      "note",
      "100",
      false
    )

    // An open row's cost is stored, not counted in the closed total.
    expect(mocks.pend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setAssignmentDetails",
        cost: "150",
        costDelta: 0,
      })
    )
  })

  it("a failed mutation discards and returns failure", async () => {
    mocks.executeAsync.mockResolvedValue({
      serverError: { code: "FORBIDDEN" },
    })
    mocks.settle.mockReturnValue({ success: false })

    const actions = getProjectTasksActions()
    const result = await actions.updateAssignment(
      "project-1",
      "task-1",
      "fetched-history-row",
      "150",
      "note",
      "100"
    )

    expect(mocks.discard).toHaveBeenCalledWith(7)
    expect(mocks.commit).not.toHaveBeenCalled()
    expect(result.success).toBe(false)
  })
})

describe("useProjectTasksActions() closed-only cost deltas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tasks = [makeTask()]
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
