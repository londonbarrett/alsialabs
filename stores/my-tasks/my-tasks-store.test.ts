import type { Task } from "@/lib/drizzle/schema"
import type { MyTask } from "@/lib/actions/tasks"
import type { TaskCommentWithAuthor } from "@/lib/types"
import { describe, expect, it } from "vitest"
import {
  EMPTY_COMMENTS,
  type MyTasksState,
} from "./my-tasks-reducer"
import { createMyTasksStore } from "./my-tasks-store"

function makeTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: "task-1",
    projectId: "project-1",
    projectName: "Renovation",
    projectColor: "#0f766e",
    projectOwnerName: "Grace",
    name: "Fix the roof",
    description: null,
    cost: "10.00",
    status: "todo",
    priority: null,
    routineId: null,
    dueDate: null,
    assigneeId: "user-1",
    assigneeName: "Ada",
    isOwner: false,
    commentCount: 0,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } satisfies MyTask
}

/** A bare task row, as `updateTaskStatus` returns inside `nextTask`. */
function makeNextTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-2",
    projectId: "project-1",
    name: "Fix the roof again",
    description: null,
    cost: "10.00",
    status: "todo",
    priority: null,
    routineId: "routine-1",
    dueDate: null,
    assigneeId: "user-1",
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-03"),
    ...overrides,
  } satisfies Task
}

function makeComment(
  overrides: Partial<TaskCommentWithAuthor> = {}
): TaskCommentWithAuthor {
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
  } satisfies TaskCommentWithAuthor
}

describe("createMyTasksStore", () => {
  it("seeds tasks with no comments loaded", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })]
    const store = createMyTasksStore(tasks)
    expect(store.getState().committed.tasks).toEqual(tasks)
    expect(store.getState().optimistic.commentsByTask).toEqual({})
    expect(store.getState().pending).toHaveLength(0)
  })

  it("exposes the plain vanilla store API", () => {
    const store = createMyTasksStore([])
    expect(typeof store).toBe("object")
    expect(typeof store.getState).toBe("function")
    expect(typeof store.setState).toBe("function")
    expect(typeof store.subscribe).toBe("function")
    expect(typeof store.getState().pend).toBe("function")
    expect(typeof store.getState().commit).toBe("function")
    expect(typeof store.getState().discard).toBe("function")
    expect(store.getState().optimistic.tasks).toEqual([])
  })

  it("updates status in place", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    const id = store
      .getState()
      .pend({ type: "updateTaskStatus", taskId: "a", status: "done" })
    store.getState().commit(id)

    expect(store.getState().optimistic.tasks[0].status).toBe("done")
  })

  it("reconciles commentCount when comments are fetched", () => {
    const store = createMyTasksStore([
      makeTask({ id: "a", commentCount: 7 }),
    ])
    store.getState().commit(
      store.getState().pend({
        type: "setComments",
        taskId: "a",
        comments: [makeComment({ id: "c1" }), makeComment({ id: "c2" })],
      })
    )
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(2)
  })

  it("bumps commentCount in the same action that appends a comment", () => {
    const store = createMyTasksStore([makeTask({ id: "a", commentCount: 1 })])
    store.getState().pend({
      type: "addComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })
    const state = store.getState().optimistic
    expect(state.commentsByTask.a).toHaveLength(1)
    expect(state.tasks[0].commentCount).toBe(2)
  })

  it("rolls commentCount back with the comment when the action is discarded", () => {
    const store = createMyTasksStore([makeTask({ id: "a", commentCount: 1 })])
    const id = store.getState().pend({
      type: "addComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })
    store.getState().discard(id)
    const state = store.getState().optimistic
    expect(state.commentsByTask.a ?? EMPTY_COMMENTS).toHaveLength(0)
    expect(state.tasks[0].commentCount).toBe(1)
  })

  it("rolls commentCount back with a discarded delete", () => {
    const store = createMyTasksStore([makeTask({ id: "a", commentCount: 1 })])
    const id = store.getState().pend({
      type: "deleteComment",
      taskId: "a",
      commentId: "c1",
    })
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(0)

    store.getState().discard(id)
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(1)
  })

  it("does not double-count when a temp comment is swapped for the real one", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    const id = store.getState().pend({
      type: "addComment",
      taskId: "a",
      comment: makeComment({ id: "temp-1" }),
    })
    store.getState().commit(id, {
      type: "replaceTempComment",
      taskId: "a",
      tempId: "temp-1",
      comment: makeComment({ id: "real-1" }),
    })
    const state = store.getState().optimistic
    expect(state.commentsByTask.a.map((c) => c.id)).toEqual(["real-1"])
    expect(state.tasks[0].commentCount).toBe(1)
  })

  it("never drives commentCount below zero", () => {
    const store = createMyTasksStore([makeTask({ id: "a", commentCount: 0 })])
    store
      .getState()
      .pend({ type: "deleteComment", taskId: "a", commentId: "c1" })
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(0)
  })
})

describe("createMyTasksStore addNextTask", () => {
  it("builds the new occurrence from the completed row's project fields", () => {
    const source = makeTask({
      id: "a",
      projectId: "project-9",
      projectName: "Kitchen",
      projectColor: "#b45309",
      projectOwnerName: "Ivy",
      assigneeName: "Ada",
      isOwner: true,
      commentCount: 4,
      status: "done",
    })
    const store = createMyTasksStore([source])
    store.getState().commit(
      store.getState().pend({
        type: "addNextTask",
        sourceTaskId: "a",
        nextTask: makeNextTask(),
      })
    )

    const state = store.getState().optimistic
    expect(state.tasks.map((t) => t.id)).toEqual(["task-2", "a"])
    const next = state.tasks[0]
    expect(next.projectId).toBe("project-9")
    expect(next.projectName).toBe("Kitchen")
    expect(next.projectColor).toBe("#b45309")
    expect(next.projectOwnerName).toBe("Ivy")
    expect(next.assigneeName).toBe("Ada")
    expect(next.isOwner).toBe(true)
    // A brand-new occurrence has no comments of its own.
    expect(next.commentCount).toBe(0)
    // The completed task keeps the count it had; only its status moved.
    expect(state.tasks[1].commentCount).toBe(4)
    expect(state.tasks[1].status).toBe("done")
  })

  it("ignores a next occurrence whose source is not in the set", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    store.getState().commit(
      store.getState().pend({
        type: "addNextTask",
        sourceTaskId: "missing",
        nextTask: makeNextTask(),
      })
    )
    expect(store.getState().optimistic.tasks.map((t) => t.id)).toEqual(["a"])
  })
})

describe("createMyTasksStore reseedFromServer", () => {
  it("adopts refreshed tasks from the server", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    store.getState().reseedFromServer([makeTask({ id: "a" }), makeTask({ id: "b" })])

    expect(store.getState().committed.tasks.map((t) => t.id)).toEqual([
      "a",
      "b",
    ])
  })

  it("keeps comments that were already loaded", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    const loaded = store.getState().pend({
      type: "setComments",
      taskId: "a",
      comments: [makeComment({ id: "c1" })],
    })
    store.getState().commit(loaded)

    store.getState().reseedFromServer([makeTask({ id: "a", commentCount: 9 })])

    // A wholesale state replace would have emptied this and made the open
    // panel refetch.
    expect(store.getState().committed.commentsByTask.a).toHaveLength(1)
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(9)
  })

  it("keeps a pending comment on top of the refreshed count", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    store.getState().pend({
      type: "addComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })

    store.getState().reseedFromServer([makeTask({ id: "a", commentCount: 4 })])

    expect(store.getState().optimistic.tasks[0].commentCount).toBe(5)
  })

  it("keeps a pending status change on top of the refreshed tasks", () => {
    const store = createMyTasksStore([
      makeTask({ id: "a", status: "todo" }),
      makeTask({ id: "b" }),
    ])
    store.getState().pend({
      type: "updateTaskStatus",
      taskId: "a",
      status: "done",
    })

    store.getState().reseedFromServer([
      makeTask({ id: "a", status: "todo" }),
      makeTask({ id: "b" }),
    ])

    expect(store.getState().optimistic.tasks[0].status).toBe("done")
  })
})

describe("myTasksReducer state shape", () => {
  it("never carries comments for a task outside the set", () => {
    const store = createMyTasksStore([makeTask({ id: "a" })])
    const state: MyTasksState = store.getState().committed
    expect(Object.keys(state)).toEqual(["tasks", "commentsByTask"])
  })
})
