import type { Project } from "@/lib/types"
import { createProjectsStore } from "./projects-store"
import {
  nextOptimisticProjectId,
  projectsReducer,
} from "./projects-reducer"
import { describe, expect, it } from "vitest"

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const OTHER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const TEMP_ID = "optimistic-1"

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    primaryOwnerId: "user-1",
    name: "Kitchen Remodel",
    description: null,
    status: "active",
    color: "#3b82f6",
    categorySlug: "remodel",
    startDate: "2026-08-01",
    endDate: "",
    location: "Medellin",
    budget: 1000,
    expenses: 250,
    tasksTotal: 4,
    tasksCompleted: 1,
    inProgressTasks: [],
    owners: [{ id: "user-1", name: "Ana", image: null }],
    collaborators: [],
    ...overrides,
  }
}

describe("projectsReducer (via stores/projects-store)", () => {
  it("prepends a new project so it matches the server's newest-first order", () => {
    const existing = makeProject()
    const created = makeProject({ id: TEMP_ID, name: "New build" })
    expect(
      projectsReducer([existing], { type: "add", project: created })
    ).toEqual([created, existing])
  })

  it("replaces the placeholder row in place", () => {
    const created = makeProject({ id: TEMP_ID })
    const real = makeProject({
      id: OTHER_ID,
      name: "Kitchen Remodel v2",
    })
    const state = [created, makeProject()]

    expect(
      projectsReducer(state, {
        type: "replaceTemp",
        tempId: TEMP_ID,
        project: real,
      })
    ).toEqual([real, state[1]])
  })

  it("leaves other rows untouched when the placeholder id is gone", () => {
    const existing = makeProject()
    const state = [existing]
    expect(
      projectsReducer(state, {
        type: "replaceTemp",
        tempId: "optimistic-missing",
        project: makeProject({ id: OTHER_ID }),
      })
    ).toEqual([existing])
  })

  it("mints unique placeholder ids", () => {
    expect(nextOptimisticProjectId()).not.toBe(
      nextOptimisticProjectId()
    )
  })
})

describe("createProjectsStore (via stores/projects-store)", () => {
  it("seeds committed and optimistic from the given projects", () => {
    const projects = [makeProject()]
    const store = createProjectsStore(projects)

    expect(store.getState().committed).toBe(projects)
    expect(store.getState().optimistic).toBe(projects)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("shows the optimistic row before the server responds", () => {
    const store = createProjectsStore([])
    const created = makeProject({ id: TEMP_ID })

    store.getState().pend({ type: "add", project: created })

    expect(store.getState().committed).toEqual([])
    expect(store.getState().optimistic).toEqual([created])
  })

  it("commits the server row in place of the placeholder", () => {
    const store = createProjectsStore([])
    const created = makeProject({ id: TEMP_ID })
    const real = makeProject({
      id: OTHER_ID,
      name: "Renamed by server",
    })
    const id = store.getState().pend({ type: "add", project: created })

    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: TEMP_ID,
      project: real,
    })

    expect(store.getState().committed).toEqual([real])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("discarding drops the row back off the list", () => {
    const store = createProjectsStore([])
    const id = store.getState().pend({
      type: "add",
      project: makeProject({ id: TEMP_ID }),
    })

    store.getState().discard(id)

    expect(store.getState().optimistic).toEqual([])
    expect(store.getState().committed).toEqual([])
  })

  it("keeps seeded rows when an optimistic row is added on top", () => {
    const seeded = [makeProject()]
    const store = createProjectsStore(seeded)
    const created = makeProject({ id: TEMP_ID })

    store.getState().pend({ type: "add", project: created })

    expect(store.getState().optimistic).toEqual([created, seeded[0]])
  })
})
