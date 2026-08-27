import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest"
import type { Session } from "next-auth"
import { z } from "zod"

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  isSuperUser: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("@/lib/actions/stores", () => ({
  getEffectiveStoreId: vi.fn(),
}))

vi.mock("@/lib/actions/project-access", () => ({
  verifyProjectAccess: vi.fn(),
}))

import { auth, isSuperUser, hasPermission } from "@/lib/auth"
import { getEffectiveStoreId } from "@/lib/actions/stores"
import { revalidatePath, updateTag } from "next/cache"
import {
  basicAction,
  storeAction,
  sessionAction,
  adminAction,
} from "@/lib/safe-action"

const mockAuth = vi.mocked(auth) as unknown as MockedFunction<
  () => Promise<Session | null>
>
const mockIsSuperUser = vi.mocked(isSuperUser)
const mockHasPermission = vi.mocked(hasPermission)
const mockGetEffectiveStoreId = vi.mocked(getEffectiveStoreId)
const mockRevalidatePath = vi.mocked(revalidatePath)
const mockUpdateTag = vi.mocked(updateTag)

function buildSession(user: {
  id: string
  role: string
  name?: string
}): Session {
  return {
    user,
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

const testAction = basicAction
  .metadata({ permission: { module: "categories", action: "view" } })
  .inputSchema(z.object({ name: z.string().min(1) }))
  .action(async ({ parsedInput }) => {
    return { greeting: `Hello, ${parsedInput.name}` }
  })

const actionWithoutPermission = basicAction
  .metadata({})
  .inputSchema(z.object({ value: z.number() }))
  .action(async ({ parsedInput }) => {
    return { doubled: parsedInput.value * 2 }
  })

describe("basicAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(
      buildSession({ id: "user-1", role: "user", name: "Test" })
    )
    mockHasPermission.mockResolvedValue(true)
  })

  it("allows permitted users", async () => {
    const result = await testAction({ name: "World" })
    expect(result.data).toEqual({ greeting: "Hello, World" })
    expect(result.serverError).toBeUndefined()
    expect(result.validationErrors).toBeUndefined()
  })

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null)
    const result = await testAction({ name: "World" })
    expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
  })

  it("rejects users without permission", async () => {
    mockHasPermission.mockResolvedValue(false)
    const result = await testAction({ name: "World" })
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("skips permission check when no permission metadata", async () => {
    const result = await actionWithoutPermission({ value: 21 })
    expect(result.data).toEqual({ doubled: 42 })
    expect(mockHasPermission).not.toHaveBeenCalled()
  })

  it("calls revalidatePath on success", async () => {
    const revalAction = basicAction
      .metadata({ revalidate: ["/dashboard/test"] })
      .action(async () => "ok")
    await revalAction()
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/test")
  })

  it("calls updateTag on success", async () => {
    const tagAction = basicAction
      .metadata({ tag: "permissions" })
      .action(async () => "ok")
    await tagAction()
    expect(mockUpdateTag).toHaveBeenCalledWith("permissions")
  })

  it("does not revalidate on error", async () => {
    const failingAction = basicAction
      .metadata({ revalidate: ["/dashboard/fail"] })
      .action(async () => {
        throw new Error("boom")
      })
    await failingAction()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe("storeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(
      buildSession({ id: "user-1", role: "retailer", name: "Test" })
    )
    mockHasPermission.mockResolvedValue(true)
    mockGetEffectiveStoreId.mockResolvedValue("store-123")
  })

  it("provides storeId in context", async () => {
    const storeTest = storeAction
      .metadata({ permission: { module: "products", action: "view" } })
      .action(async ({ ctx }) => {
        return { storeId: ctx.storeId }
      })
    const result = await storeTest()
    expect(result.data).toEqual({ storeId: "store-123" })
  })
})

describe("sessionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(
      buildSession({ id: "user-1", role: "user", name: "Test" })
    )
    mockHasPermission.mockResolvedValue(true)
    mockIsSuperUser.mockReturnValue(false)
  })

  it("provides the authenticated session in context", async () => {
    const sessionTest = sessionAction
      .metadata({ permission: { module: "projects", action: "view" } })
      .action(async ({ ctx }) => {
        return {
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
        }
      })
    const result = await sessionTest()
    expect(result.data).toEqual({ userId: "user-1", role: "user" })
  })

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null)
    const sessionTest = sessionAction
      .metadata({ permission: { module: "projects", action: "view" } })
      .action(async () => "should not run")
    const result = await sessionTest()
    expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
  })
})

describe("adminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows super users", async () => {
    mockAuth.mockResolvedValue(
      buildSession({ id: "admin-1", role: "super", name: "Admin" })
    )
    mockIsSuperUser.mockReturnValue(true)
    const adminTest = adminAction
      .metadata({})
      .action(async ({ ctx }) => {
        return { adminId: ctx.session.user.id }
      })
    const result = await adminTest()
    expect(result.data).toEqual({ adminId: "admin-1" })
  })

  it("rejects non-super users", async () => {
    mockAuth.mockResolvedValue(
      buildSession({ id: "user-1", role: "user", name: "Test" })
    )
    mockIsSuperUser.mockReturnValue(false)
    const adminTest = adminAction
      .metadata({})
      .action(async () => "should not run")
    const result = await adminTest()
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })

  it("rejects unauthenticated users", async () => {
    mockAuth.mockResolvedValue(null)
    const adminTest = adminAction
      .metadata({})
      .action(async () => "should not run")
    const result = await adminTest()
    expect(result.serverError).toEqual({ code: "FORBIDDEN" })
  })
})

describe("validation errors", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(
      buildSession({ id: "user-1", role: "user", name: "Test" })
    )
    mockHasPermission.mockResolvedValue(true)
  })

  it("returns validation errors for bad input", async () => {
    const result = await testAction({ name: "" })
    expect(result.validationErrors).toBeDefined()
    expect(result.data).toBeUndefined()
  })
})
