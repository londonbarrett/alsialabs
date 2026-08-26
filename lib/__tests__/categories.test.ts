import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/drizzle/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock("@/lib/auth", () => ({
  requirePermission: vi.fn(),
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

import { db } from "@/lib/drizzle/client"
import { requirePermission } from "@/lib/auth"

const mockDb = vi.mocked(db)
const mockRequirePermission = vi.mocked(requirePermission)

describe("categories actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequirePermission.mockResolvedValue(undefined as any)
  })

  describe("createCategory", () => {
    it("creates a category with valid data", async () => {
      const { createCategory } = await import("@/lib/actions/categories")

      const fakeCategory = {
        id: "cat-1",
        name: "Test",
        slug: "test",
        description: "",
        taxonomyId: "tax-1",
      }
      mockDb.returning.mockResolvedValue([fakeCategory])

      const result = await createCategory({
        name: "Test",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.data).toEqual(fakeCategory)
      expect(mockRequirePermission).toHaveBeenCalledWith("categories", "create")
    })

    it("rejects when permission is denied", async () => {
      mockRequirePermission.mockRejectedValue(new Error("Forbidden"))
      const { createCategory } = await import("@/lib/actions/categories")

      const result = await createCategory({
        name: "Test",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.serverError).toBeDefined()
    })
  })

  describe("updateCategory", () => {
    it("updates a category with valid data", async () => {
      const { updateCategory } = await import("@/lib/actions/categories")

      const fakeCategory = {
        id: "cat-1",
        name: "Updated",
        slug: "updated",
        description: "desc",
        taxonomyId: "tax-1",
      }
      mockDb.returning.mockResolvedValue([fakeCategory])

      const result = await updateCategory({
        id: "cat-1",
        name: "Updated",
        slug: "updated",
      })

      expect(result.data).toEqual(fakeCategory)
      expect(mockRequirePermission).toHaveBeenCalledWith("categories", "edit")
    })

    it("returns NOT_FOUND when category does not exist", async () => {
      mockDb.returning.mockResolvedValue([])
      const { updateCategory } = await import("@/lib/actions/categories")

      const result = await updateCategory({
        id: "nonexistent",
        name: "Test",
        slug: "test",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("deleteCategory", () => {
    it("deletes a category", async () => {
      const { deleteCategory } = await import("@/lib/actions/categories")

      mockDb.returning.mockResolvedValue([{ id: "cat-1" }])

      const result = await deleteCategory({ id: "cat-1" })

      expect(result.data).toBeUndefined()
      expect(result.serverError).toBeUndefined()
      expect(mockRequirePermission).toHaveBeenCalledWith("categories", "delete")
    })

    it("returns NOT_FOUND when category does not exist", async () => {
      mockDb.returning.mockResolvedValue([])
      const { deleteCategory } = await import("@/lib/actions/categories")

      const result = await deleteCategory({ id: "nonexistent" })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("validation", () => {
    it("rejects empty name", async () => {
      const { createCategory } = await import("@/lib/actions/categories")

      const result = await createCategory({
        name: "",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.validationErrors).toBeDefined()
    })

    it("rejects empty slug", async () => {
      const { createCategory } = await import("@/lib/actions/categories")

      const result = await createCategory({
        name: "Test",
        slug: "",
        taxonomyId: "tax-1",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })
})
