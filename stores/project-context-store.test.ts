import type {
  ProjectOwner,
  ProjectContext,
} from "@/lib/actions/projects"
import type { ProjectMember } from "@/lib/types"
import {
  applyProjectContextAction,
  createProjectContextStore,
  projectContextReducer,
} from "./project-context-store"
import { describe, expect, it } from "vitest"

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const OTHER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

function makeMember(
  overrides: Partial<ProjectMember> = {}
): ProjectMember {
  return {
    userId: "user-2",
    userName: "Luis",
    userEmail: "luis@example.com",
    userImage: null,
    ...overrides,
  }
}

function makeOwner(
  overrides: Partial<ProjectOwner> = {}
): ProjectOwner {
  return {
    ...makeMember({ userId: "user-1", userName: "Ana" }),
    primaryOwnerId: "user-1",
    ...overrides,
  }
}

/** An owner row for a user who is not the primary owner. */
function makeOwnerMember(userId: string): ProjectOwner {
  return { ...makeMember({ userId }), primaryOwnerId: "user-1" }
}

function makeContext(
  overrides: Partial<ProjectContext> = {}
): ProjectContext {
  return {
    project: {
      id: PROJECT_ID,
      primaryOwnerId: "user-1",
      categoryId: "cat-1",
      name: "Kitchen Remodel",
      description: null,
      status: "active",
      startDate: "2026-08-01",
      endDate: null,
      location: "Medellin",
      budget: "1000.00",
      color: "#3b82f6",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      categorySlug: "remodel",
      categoryName: "Remodel",
    },
    owners: [makeOwner()],
    collaborators: [],
    permissions: ["projects:view", "projects:edit"],
    session: {
      user: { id: "user-1", role: "user" },
      expires: "2026-09-01T00:00:00.000Z",
    } as unknown as ProjectContext["session"],
    isCurrentUserAdmin: false,
    categories: [
      { id: "cat-1", slug: "remodel", name: "Remodel" },
      { id: "cat-2", slug: "new-build", name: "New build" },
    ],
    ...overrides,
  }
}

describe("projectContextReducer (via stores/project-context-store)", () => {
  it("patches the project without dropping joined category fields", () => {
    const result = projectContextReducer(makeContext(), {
      type: "patchProject",
      patch: { name: "Bathroom Remodel" },
    })
    expect(result.project.name).toBe("Bathroom Remodel")
    expect(result.project.categorySlug).toBe("remodel")
    expect(result.project.categoryName).toBe("Remodel")
  })

  it("patchProject leaves membership untouched", () => {
    const context = makeContext({ collaborators: [makeMember()] })
    const result = projectContextReducer(context, {
      type: "patchProject",
      patch: { status: "completed" },
    })
    expect(result.owners).toBe(context.owners)
    expect(result.collaborators).toBe(context.collaborators)
  })

  it("adds an owner", () => {
    const result = projectContextReducer(makeContext(), {
      type: "addOwner",
      member: makeOwnerMember("user-3"),
    })
    expect(result.owners.map((o) => o.userId)).toEqual([
      "user-1",
      "user-3",
    ])
    expect(result.collaborators).toHaveLength(0)
  })

  it("ignores an owner that is already there", () => {
    const context = makeContext()
    const result = projectContextReducer(context, {
      type: "addOwner",
      member: makeOwnerMember("user-1"),
    })
    expect(result).toBe(context)
  })

  it("adds a collaborator", () => {
    const result = projectContextReducer(makeContext(), {
      type: "addCollaborator",
      member: makeMember(),
    })
    expect(result.collaborators.map((c) => c.userId)).toEqual(["user-2"])
    expect(result.owners).toHaveLength(1)
  })

  it("ignores a collaborator that is already there", () => {
    const context = makeContext({ collaborators: [makeMember()] })
    const result = projectContextReducer(context, {
      type: "addCollaborator",
      member: makeMember(),
    })
    expect(result).toBe(context)
  })

  it("removeMember drops the user from both lists at once", () => {
    const context = makeContext({
      owners: [makeOwner(), makeOwnerMember("user-3")],
      collaborators: [makeMember()],
    })
    const result = projectContextReducer(context, {
      type: "removeMember",
      userId: "user-2",
    })
    expect(result.collaborators).toHaveLength(0)
    expect(result.owners.map((o) => o.userId)).toEqual(["user-1", "user-3"])
  })

  it("removeMember is a no-op for a user who is not on the project", () => {
    const context = makeContext()
    const result = projectContextReducer(context, {
      type: "removeMember",
      userId: "user-404",
    })
    expect(result).toBe(context)
  })
})

describe("applyProjectContextAction (via stores/project-context-store)", () => {
  it("applies the action and ignores the key, since there is only one project", () => {
    const result = applyProjectContextAction(makeContext(), OTHER_ID, {
      type: "patchProject",
      patch: { name: "Bathroom Remodel" },
    })
    expect(result.project.name).toBe("Bathroom Remodel")
  })
})

describe("createProjectContextStore (via stores/project-context-store)", () => {
  function derive(store: ReturnType<typeof createProjectContextStore>) {
    const state = store.getState()
    return state.pending.reduce(
      (acc, item) => applyProjectContextAction(acc, item.key, item.action),
      state.committed
    )
  }

  it("seeds committed from the given context with nothing pending", () => {
    const context = makeContext()
    const store = createProjectContextStore(context)
    expect(store.getState().committed).toBe(context)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend keeps committed untouched while the derive exposes the action", () => {
    const context = makeContext()
    const store = createProjectContextStore(context)
    const id = store
      .getState()
      .pend({ type: "patchProject", patch: { name: "Optimistic" } })

    expect(store.getState().committed).toBe(context)
    expect(store.getState().pending).toHaveLength(1)
    expect(derive(store).project.name).toBe("Optimistic")

    store.getState().commit(id)
    expect(store.getState().committed.project.name).toBe("Optimistic")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit layers the server row on top of the optimistic patch", () => {
    const store = createProjectContextStore(makeContext())
    const id = store.getState().pend({
      type: "patchProject",
      patch: { name: "Optimistic", status: "active" },
    })
    store.getState().commit(id, {
      type: "patchProject",
      patch: { name: "Server Name", status: "completed" },
    })
    const project = store.getState().committed.project
    expect(project.name).toBe("Server Name")
    expect(project.status).toBe("completed")
    expect(project.categorySlug).toBe("remodel")
  })

  it("discard reverts the failed action", () => {
    const context = makeContext()
    const store = createProjectContextStore(context)
    const id = store
      .getState()
      .pend({ type: "removeMember", userId: "user-1" })
    expect(derive(store).owners).toHaveLength(0)

    store.getState().discard(id)
    expect(store.getState().committed).toBe(context)
    expect(derive(store).owners).toHaveLength(1)
  })

  it("commits a membership removal, so the member leaves without a refetch", () => {
    const store = createProjectContextStore(
      makeContext({ collaborators: [makeMember()] })
    )
    const id = store.getState().pend({
      type: "removeMember",
      userId: "user-2",
    })
    store.getState().commit(id)
    expect(store.getState().committed.collaborators).toHaveLength(0)
  })

  it("commits a membership addition, so the new pill renders without a refetch", () => {
    const store = createProjectContextStore(makeContext())
    const member = makeMember({ userId: "user-7", userName: "Sara" })
    const id = store.getState().pend({ type: "addCollaborator", member })
    expect(derive(store).collaborators).toHaveLength(1)

    store.getState().commit(id)
    expect(store.getState().committed.collaborators[0]).toEqual(member)
  })

  it("gives each provider its own store, so two projects never share state", () => {
    const first = createProjectContextStore(makeContext())
    const second = createProjectContextStore(
      makeContext({
        project: { ...makeContext().project, id: OTHER_ID, name: "Other" },
      })
    )

    first.getState().pend({ type: "patchProject", patch: { name: "Renamed" } })
    first.getState().commit(
      first.getState().pending[0].id
    )

    expect(first.getState().committed.project.name).toBe("Renamed")
    expect(second.getState().committed.project.name).toBe("Other")
    expect(second.getState().committed.project.id).toBe(OTHER_ID)
  })
})
