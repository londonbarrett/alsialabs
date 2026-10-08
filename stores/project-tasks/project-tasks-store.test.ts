import type { TaskCommentWithAuthor } from "@/lib/types"
import { describe, expect, it } from "vitest"
import {
  EMPTY_COMMENTS,
  type TaskWithCommentCount,
} from "./project-tasks-reducer"
import { createProjectTasksStore } from "./project-tasks-store"

function makeTask(
  overrides: Partial<TaskWithCommentCount> = {}
): TaskWithCommentCount {
  return {
    id: "task-1",
    projectId: "project-1",
    name: "Fix the roof",
    description: null,
    cost: "10.00",
    status: "todo",
    priority: null,
    dueDate: null,
    routineId: null,
    assigneeId: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    commentCount: 0,
    assigneeName: null,
    ...overrides,
  } satisfies TaskWithCommentCount
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

describe("createProjectTasksStore", () => {
  it("seeds tasks with no comments loaded", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })]
    const store = createProjectTasksStore(tasks)
    expect(store.getState().committed.tasks).toEqual(tasks)
    expect(store.getState().optimistic.commentsByTask).toEqual({})
    expect(store.getState().pending).toHaveLength(0)
  })

  it("exposes the plain vanilla store API", () => {
    const store = createProjectTasksStore([])
    expect(typeof store).toBe("object")
    expect(typeof store.getState).toBe("function")
    expect(typeof store.setState).toBe("function")
    expect(typeof store.subscribe).toBe("function")
    expect(typeof store.getState().pend).toBe("function")
    expect(typeof store.getState().commit).toBe("function")
    expect(typeof store.getState().discard).toBe("function")
    // Nothing is bolted onto the API object with Object.assign.
    expect(store.getState().optimistic.tasks).toEqual([])
  })

  it("adds a task optimistically and drops it when discarded", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    const id = store.getState().pend({
      type: "addTask",
      task: makeTask({ id: "temp-1", name: "New task" }),
    })
    expect(store.getState().optimistic.tasks.map((t) => t.id)).toEqual([
      "temp-1",
      "a",
    ])

    store.getState().discard(id)
    expect(store.getState().optimistic.tasks.map((t) => t.id)).toEqual(["a"])
  })

  it("replaces a temp task on commit so later mutations target the real id", () => {
    const store = createProjectTasksStore([])
    const id = store.getState().pend({
      type: "addTask",
      task: makeTask({ id: "temp-1" }),
    })
    store.getState().commit(id, {
      type: "replaceTempTask",
      tempId: "temp-1",
      task: makeTask({ id: "real-1" }),
    })
    expect(store.getState().optimistic.tasks.map((t) => t.id)).toEqual([
      "real-1",
    ])
  })

  it("updates status and priority in place", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    const statusId = store
      .getState()
      .pend({ type: "updateTaskStatus", taskId: "a", status: "done" })
    const priorityId = store
      .getState()
      .pend({ type: "updateTaskPriority", taskId: "a", priority: "urgent" })
    store.getState().commit(statusId)
    store.getState().commit(priorityId)

    const task = store.getState().optimistic.tasks[0]
    expect(task.status).toBe("done")
    expect(task.priority).toBe("urgent")
  })

  it("forgets loaded comments when the task is deleted", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    store
      .getState()
      .commit(store.getState().pend({
        type: "setComments",
        taskId: "a",
        comments: [makeComment()],
      }))
    expect(store.getState().optimistic.commentsByTask.a).toHaveLength(1)

    store
      .getState()
      .commit(store.getState().pend({ type: "deleteTask", taskId: "a" }))
    expect(store.getState().optimistic.tasks).toEqual([])
    expect(store.getState().optimistic.commentsByTask).toEqual({})
  })

  it("reconciles commentCount when comments are fetched", () => {
    const store = createProjectTasksStore([
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
    const store = createProjectTasksStore([
      makeTask({ id: "a", commentCount: 1 }),
    ])
    store.getState().pend({
      type: "createComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })
    const state = store.getState().optimistic
    expect(state.commentsByTask.a).toHaveLength(1)
    expect(state.tasks[0].commentCount).toBe(2)
  })

  it("rolls commentCount back with the comment when the action is discarded", () => {
    const store = createProjectTasksStore([
      makeTask({ id: "a", commentCount: 1 }),
    ])
    const id = store.getState().pend({
      type: "createComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })
    store.getState().discard(id)
    const state = store.getState().optimistic
    expect(state.commentsByTask.a ?? EMPTY_COMMENTS).toHaveLength(0)
    expect(state.tasks[0].commentCount).toBe(1)
  })

  it("does not double-count when a temp comment is swapped for the real one", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    const id = store.getState().pend({
      type: "createComment",
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
    const store = createProjectTasksStore([
      makeTask({ id: "a", commentCount: 0 }),
    ])
    store.getState().pend({ type: "deleteComment", taskId: "a", commentId: "c1" })
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(0)
  })

  it("keeps concurrent mutations independent when one fails", () => {
    const store = createProjectTasksStore([
      makeTask({ id: "a", commentCount: 1 }),
      makeTask({ id: "b", commentCount: 0 }),
    ])
    const failed = store.getState().pend({ type: "deleteTask", taskId: "a" })
    store.getState().pend({
      type: "createComment",
      taskId: "b",
      comment: makeComment({ id: "c1", taskId: "b" }),
    })

    store.getState().discard(failed)
    const state = store.getState().optimistic
    // The reverted delete must not take the still-pending comment with it.
    expect(state.tasks.map((t) => t.id)).toEqual(["a", "b"])
    expect(state.tasks.find((t) => t.id === "b")?.commentCount).toBe(1)
  })
})

describe("createProjectTasksStore reseedFromServer", () => {
  it("adopts refreshed tasks from the server", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    store.getState().reseedFromServer([makeTask({ id: "a" }), makeTask({ id: "b" })])

    expect(
      store.getState().committed.tasks.map((t) => t.id)
    ).toEqual(["a", "b"])
  })

  it("keeps comments that were already loaded", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    const loaded = store.getState().pend({
      type: "setComments",
      taskId: "a",
      comments: [makeComment({ id: "c1" })],
    })
    store.getState().commit(loaded)

    store.getState().reseedFromServer([makeTask({ id: "a", commentCount: 9 })])

    // A wholesale state replace would have emptied this and made the open panel
    // refetch.
    expect(store.getState().committed.commentsByTask.a).toHaveLength(1)
    // The server-owned count is adopted.
    expect(store.getState().optimistic.tasks[0].commentCount).toBe(9)
  })

  it("keeps a pending comment on top of the refreshed count", () => {
    const store = createProjectTasksStore([makeTask({ id: "a" })])
    store.getState().pend({
      type: "createComment",
      taskId: "a",
      comment: makeComment({ id: "c1" }),
    })

    store.getState().reseedFromServer([makeTask({ id: "a", commentCount: 4 })])

    expect(store.getState().optimistic.tasks[0].commentCount).toBe(5)
  })

  it("does not resurrect a task the pending delete removed", () => {
    const store = createProjectTasksStore([
      makeTask({ id: "a" }),
      makeTask({ id: "b" }),
    ])
    store.getState().pend({ type: "deleteTask", taskId: "b" })

    store.getState().reseedFromServer([makeTask({ id: "a" }), makeTask({ id: "b" })])

    expect(store.getState().optimistic.tasks.map((t) => t.id)).toEqual([
      "a",
    ])
  })
})
