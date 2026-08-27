import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))

const state = vi.hoisted(() => ({
  mock: null as unknown as {
    resetMocks(): void
    onSelect(table: unknown): { respond(data: unknown): unknown }
    onInsert(table: unknown): { respond(data: unknown): unknown }
    onUpdate(table: unknown): { respond(data: unknown): unknown }
    onDelete(table: unknown): { respond(data: unknown): unknown }
  },
}))

vi.mock("@/lib/drizzle/client", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js")
  const { mockDatabase } = await import("vitest-drizzle-mock")
  const schema = await import("@/lib/drizzle/schema")
  const db = drizzle.mock({ schema })
  state.mock = mockDatabase(db)
  return { db }
})

import * as schema from "@/lib/drizzle/schema"
import { auth, hasPermission } from "@/lib/auth"
import {
  getTaxonomies,
  getCategoriesByTaxonomy,
  getCategoriesByTaxonomyList,
  checkSlugExists,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)

describe("categories actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
  })

  describe("getTaxonomies", () => {
    it("returns the list of taxonomies", async () => {
      const fakeTaxonomies = [
        { id: "tax-1", name: "Product Line", slug: "product-line" },
      ]
      state.mock.onSelect(schema.taxonomyTable).respond(fakeTaxonomies)

      const result = await getTaxonomies()

      expect(result.data).toEqual(fakeTaxonomies)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "view"
      )
    })
  })

  describe("getCategoriesByTaxonomy", () => {
    it("returns categories for the given taxonomy slug", async () => {
      const fakeCategories = [
        {
          id: "cat-1",
          taxonomyId: "tax-1",
          slug: "shoes",
          name: "Shoes",
          description: "Footwear",
        },
      ]
      state.mock.onSelect(schema.categoryTable).respond(fakeCategories)

      const result = await getCategoriesByTaxonomy({ taxonomySlug: "products" })

      expect(result.data).toEqual(fakeCategories)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "view"
      )
    })
  })

  describe("getCategoriesByTaxonomyList", () => {
    it("returns a minimal category list for the given taxonomy slug", async () => {
      const fakeCategories = [
        { id: "cat-1", slug: "shoes", name: "Shoes" },
      ]
      state.mock.onSelect(schema.categoryTable).respond(fakeCategories)

      const result = await getCategoriesByTaxonomyList({ taxonomySlug: "products" })

      expect(result.data).toEqual(fakeCategories)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "view"
      )
    })
  })

  describe("checkSlugExists", () => {
    it("returns exists: false when no category matches", async () => {
      state.mock.onSelect(schema.categoryTable).respond([])

      const result = await checkSlugExists({
        taxonomyId: "tax-1",
        slug: "shoes",
      })

      expect(result.data).toEqual({ exists: false })
    })

    it("returns exists: true when a category matches", async () => {
      state.mock.onSelect(schema.categoryTable).respond([{ id: "cat-1" }])

      const result = await checkSlugExists({
        taxonomyId: "tax-1",
        slug: "shoes",
      })

      expect(result.data).toEqual({ exists: true })
    })

    it("excludes specified ID from check", async () => {
      state.mock.onSelect(schema.categoryTable).respond([{ id: "cat-1" }])

      const result = await checkSlugExists({
        taxonomyId: "tax-1",
        slug: "shoes",
        excludeId: "cat-1",
      })

      expect(result.data).toEqual({ exists: false })
    })
  })

  describe("createCategory", () => {
    it("creates a category with valid data", async () => {
      const fakeCategory = {
        id: "cat-1",
        name: "Test",
        slug: "test",
        description: "",
        taxonomyId: "tax-1",
      }
      state.mock.onInsert(schema.categoryTable).respond([fakeCategory])

      const result = await createCategory({
        name: "Test",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.data).toEqual(fakeCategory)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "create"
      )
    })

    it("rejects when permission is denied", async () => {
      mockHasPermission.mockResolvedValue(false)

      const result = await createCategory({
        name: "Test",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("updateCategory", () => {
    it("updates a category with valid data", async () => {
      const fakeCategory = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Updated",
        slug: "updated",
        description: "desc",
        taxonomyId: "tax-1",
      }
      state.mock.onUpdate(schema.categoryTable).respond([fakeCategory])

      const result = await updateCategory({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Updated",
        slug: "updated",
      })

      expect(result.data).toEqual(fakeCategory)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "edit"
      )
    })

    it("returns NOT_FOUND when category does not exist", async () => {
      state.mock.onUpdate(schema.categoryTable).respond([])

      const result = await updateCategory({
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        name: "Test",
        slug: "test",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("deleteCategory", () => {
    it("deletes a category", async () => {
      state.mock.onDelete(schema.categoryTable).respond([
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      ])

      const result = await deleteCategory({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })

      expect(result.data).toBeUndefined()
      expect(result.serverError).toBeUndefined()
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "categories",
        "delete"
      )
    })

    it("returns NOT_FOUND when category does not exist", async () => {
      state.mock.onDelete(schema.categoryTable).respond([])

      const result = await deleteCategory({
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("validation", () => {
    it("rejects empty name", async () => {
      const result = await createCategory({
        name: "",
        slug: "test",
        taxonomyId: "tax-1",
      })

      expect(result.validationErrors).toBeDefined()
    })

    it("rejects empty slug", async () => {
      const result = await createCategory({
        name: "Test",
        slug: "",
        taxonomyId: "tax-1",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })
})
