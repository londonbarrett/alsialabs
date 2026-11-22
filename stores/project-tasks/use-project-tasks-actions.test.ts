import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  executeAsync: vi.fn(),
  pend: vi.fn<(action: unknown) => number>(() => 7),
  commit: vi.fn(),
  discard: vi.fn(),
  settle: vi.fn(),
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
      optimistic: { tasks: [], commentsByTask: {} },
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

describe("useProjectTasksActions().updateAssignmentCost", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
