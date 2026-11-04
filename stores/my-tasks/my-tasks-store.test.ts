import type { MyAssignmentDTO, TaskAssignmentDTO } from "@/actions/tasks/schemas"
import type { TaskCommentWithAuthorDTO } from "@/actions/schemas/task-comment"
import { describe, expect, it } from "vitest"
import type { MyTasksState } from "./my-tasks-reducer"
import { createMyTasksStore } from "./my-tasks-store"

function makeAssignment(
  overrides: Partial<MyAssignmentDTO> = {}
): MyAssignmentDTO {
  return {
    assignmentId: "assignment-1",
    taskId: "task-1",
    projectId: "project-1",
    name: "Fix the roof",
    description: null,
    priority: null,
    projectName: "Renovation",
    projectColor: "#0f766e",
    projectOwnerName: "Grace",
    role: "collaborator",
    status: "todo",
    comment: null,
    startDate: null,
    endDate: null,
    recurrence: null,
    commentCount: 0,
    ...overrides,
  }
}

function makeNextAssignment(
  overrides: Partial<TaskAssignmentDTO> = {}
): TaskAssignmentDTO {
  return {
    id: "assignment-2",
    taskId: "task-1",
    userId: "user-1",
    userName: "Ada",
    userEmail: "ada@test.local",
    userImage: null,
    status: "todo",
    comment: null,
    startDate: new Date("2026-11-06T09:00:00"),
    endDate: new Date("2026-11-06T11:00:00"),
    ...overrides,
  }
}

function makeComment(
  overrides: Partial<TaskCommentWithAuthorDTO> = {}
): TaskCommentWithAuthorDTO {
  return {
    id: "comment-1",
    taskId: "task-1",
    authorId: "user-1",
    authorName: "Ada",
    authorImage: null,
    content: "On it",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    ...overrides,
  }
}

describe("createMyTasksStore", () => {
  it("seeds the visible list with no comments loaded", () => {
    const assignments = [makeAssignment({ assignmentId: "a" })]
    const store = createMyTasksStore({ assignments })

    expect(store.getState().committed.assignments).toEqual(
      assignments
    )
    expect(store.getState().optimistic.commentsByTask).toEqual({})
  })

  it("exposes the plain vanilla store API", () => {
    const store = createMyTasksStore({ assignments: [] })
    expect(typeof store.getState().pend).toBe("function")
    expect(typeof store.getState().commit).toBe("function")
    expect(typeof store.getState().discard).toBe("function")
  })

  it("updates status in place while it stays open", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a" })],
    })
    store.getState().commit(
      store.getState().pend({
        type: "updateAssignment",
        assignmentId: "a",
        status: "in_progress",
      })
    )

    expect(
      store.getState().optimistic.assignments.map((a) => a.status)
    ).toEqual(["in_progress"])
  })

  it("drops an assignment from the list when its status turns terminal", () => {
    const store = createMyTasksStore({
      assignments: [
        makeAssignment({ assignmentId: "a" }),
        makeAssignment({ assignmentId: "b" }),
      ],
    })
    store.getState().commit(
      store.getState().pend({
        type: "updateAssignment",
        assignmentId: "a",
        status: "done",
      })
    )

    expect(
      store.getState().optimistic.assignments.map(
        (a) => a.assignmentId
      )
    ).toEqual(["b"])
  })

  it("restores the assignment when the status change is discarded", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a" })],
    })
    const id = store.getState().pend({
      type: "updateAssignment",
      assignmentId: "a",
      status: "done",
    })
    expect(store.getState().optimistic.assignments).toHaveLength(0)

    store.getState().discard(id)
    expect(
      store.getState().optimistic.assignments.map(
        (a) => a.status
      )
    ).toEqual(["todo"])
  })

  it("adds the next occurrence using the source's project fields", () => {
    const source = makeAssignment({
      assignmentId: "a",
      status: "done",
      projectId: "project-9",
      projectName: "Kitchen",
      projectColor: "#b45309",
      projectOwnerName: "Ivy",
      role: "owner",
      commentCount: 4,
    })
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "b" })],
    })

    store.getState().commit(
      store.getState().pend({
        type: "insertNextAssignment",
        source,
        assignment: makeNextAssignment(),
      })
    )

    const assignments = store.getState().optimistic.assignments
    expect(assignments.map((a) => a.assignmentId)).toEqual([
      "assignment-2",
      "b",
    ])
    const next = assignments[0]
    expect(next.projectId).toBe("project-9")
    expect(next.projectName).toBe("Kitchen")
    expect(next.projectColor).toBe("#b45309")
    expect(next.projectOwnerName).toBe("Ivy")
    expect(next.role).toBe("owner")
    expect(next.status).toBe("todo")
    expect(next.commentCount).toBe(0)
  })
})

describe("my tasks comments", () => {
  it("reconciles commentCount when comments are fetched", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a", commentCount: 7 })],
    })
    store.getState().commit(
      store.getState().pend({
        type: "setComments",
        taskId: "task-1",
        comments: [
          makeComment({ id: "c1" }),
          makeComment({ id: "c2" }),
        ],
      })
    )

    expect(
      store.getState().optimistic.assignments[0].commentCount
    ).toBe(2)
  })

  it("bumps commentCount in the same action that appends a comment", () => {
    const store = createMyTasksStore({
      assignments: [
        makeAssignment({ assignmentId: "a", commentCount: 1 }),
      ],
    })
    store.getState().pend({
      type: "createComment",
      taskId: "task-1",
      comment: makeComment({ id: "c1" }),
    })

    const state = store.getState().optimistic
    expect(state.commentsByTask["task-1"]).toHaveLength(1)
    expect(state.assignments[0].commentCount).toBe(2)
  })

  it("rolls commentCount back with a discarded delete", () => {
    const store = createMyTasksStore({
      assignments: [
        makeAssignment({ assignmentId: "a", commentCount: 1 }),
      ],
    })
    const id = store.getState().pend({
      type: "deleteComment",
      taskId: "task-1",
      commentId: "c1",
    })
    expect(
      store.getState().optimistic.assignments[0].commentCount
    ).toBe(0)

    store.getState().discard(id)
    expect(
      store.getState().optimistic.assignments[0].commentCount
    ).toBe(1)
  })

  it("never drives commentCount below zero", () => {
    const store = createMyTasksStore({
      assignments: [
        makeAssignment({ assignmentId: "a", commentCount: 0 }),
      ],
    })
    store
      .getState()
      .pend({ type: "deleteComment", taskId: "task-1", commentId: "c1" })
    expect(
      store.getState().optimistic.assignments[0].commentCount
    ).toBe(0)
  })
})

describe("createMyTasksStore reseedFromServer", () => {
  it("adopts the refreshed list", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a" })],
    })
    store
      .getState()
      .reseedFromServer([makeAssignment({ assignmentId: "b" })])

    expect(
      store.getState().committed.assignments.map(
        (a) => a.assignmentId
      )
    ).toEqual(["b"])
  })

  it("keeps comments that were already loaded", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a" })],
    })
    store.getState().commit(
      store.getState().pend({
        type: "setComments",
        taskId: "task-1",
        comments: [makeComment({ id: "c1" })],
      })
    )

    store
      .getState()
      .reseedFromServer([
        makeAssignment({ assignmentId: "a", commentCount: 9 }),
      ])

    expect(
      store.getState().committed.commentsByTask["task-1"]
    ).toHaveLength(1)
    expect(
      store.getState().optimistic.assignments[0].commentCount
    ).toBe(9)
  })
})

describe("myTasksReducer state shape", () => {
  it("carries the list and comments", () => {
    const store = createMyTasksStore({
      assignments: [makeAssignment({ assignmentId: "a" })],
    })
    const state: MyTasksState = store.getState().committed
    expect(Object.keys(state).sort()).toEqual([
      "assignments",
      "commentsByTask",
    ])
  })
})
