import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("@/lib/actions/stores", () => ({
  getEffectiveStoreId: vi.fn(),
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
import { getEffectiveStoreId } from "@/lib/actions/stores"
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  checkSkuExists,
} from "@/lib/actions/products"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockGetEffectiveStoreId = vi.mocked(getEffectiveStoreId)

describe("products actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    mockGetEffectiveStoreId.mockResolvedValue("store-1")
  })

  describe("getProducts", () => {
    it("returns products list", async () => {
      const fakeProducts = [
        {
          id: "prod-1",
          name: "Widget",
          description: "A widget",
          store_id: "store-1",
          store_name: "Store A",
          sku: "WDG-001",
          unit: "pcs",
        },
      ]
      state.mock.onSelect(schema.productsTable).respond(fakeProducts)

      const result = await getProducts()

      expect(result.data).toEqual(fakeProducts)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "products",
        "view"
      )
    })
  })

  describe("createProduct", () => {
    it("creates a product with valid data", async () => {
      const fakeProduct = {
        id: "prod-1",
        name: "Widget",
        description: "A widget",
        store_id: "store-1",
        sku: "WDG-001",
        unit: "pcs",
      }
      state.mock.onInsert(schema.productsTable).respond([fakeProduct])

      const result = await createProduct({
        name: "Widget",
        description: "A widget",
        store_id: "store-1",
        sku: "WDG-001",
        unit: "pcs",
      })

      expect(result.data).toEqual(fakeProduct)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "products",
        "create"
      )
    })

    it("rejects when permission is denied", async () => {
      mockHasPermission.mockResolvedValue(false)

      const result = await createProduct({
        name: "Widget",
        store_id: "store-1",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("updateProduct", () => {
    it("updates a product with valid data", async () => {
      const fakeProduct = {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Updated Widget",
        description: "Updated",
        store_id: "store-1",
        sku: "WDG-002",
        unit: "pcs",
      }
      state.mock.onUpdate(schema.productsTable).respond([fakeProduct])

      const result = await updateProduct({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        name: "Updated Widget",
        description: "Updated",
        store_id: "store-1",
        sku: "WDG-002",
        unit: "pcs",
      })

      expect(result.data).toEqual(fakeProduct)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "products",
        "edit"
      )
    })

    it("returns NOT_FOUND when product does not exist", async () => {
      state.mock.onUpdate(schema.productsTable).respond([])

      const result = await updateProduct({
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        name: "Test",
        store_id: "store-1",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("deleteProduct", () => {
    it("deletes a product", async () => {
      state.mock.onDelete(schema.productsTable).respond([
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      ])

      const result = await deleteProduct({
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })

      expect(result.data).toBeUndefined()
      expect(result.serverError).toBeUndefined()
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "products",
        "delete"
      )
    })

    it("returns NOT_FOUND when product does not exist", async () => {
      state.mock.onDelete(schema.productsTable).respond([])

      const result = await deleteProduct({
        id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("checkSkuExists", () => {
    it("returns exists: false when SKU is empty", async () => {
      const result = await checkSkuExists({ sku: "" })

      expect(result.data).toEqual({ exists: false })
    })

    it("returns exists: true when SKU exists", async () => {
      state.mock.onSelect(schema.productsTable).respond([{ id: "prod-1" }])

      const result = await checkSkuExists({ sku: "WDG-001" })

      expect(result.data).toEqual({ exists: true })
    })

    it("excludes specified ID from check", async () => {
      state.mock.onSelect(schema.productsTable).respond([
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
      ])

      const result = await checkSkuExists({
        sku: "WDG-001",
        excludeId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })

      expect(result.data).toEqual({ exists: false })
    })
  })

  describe("validation", () => {
    it("rejects empty name", async () => {
      const result = await createProduct({
        name: "",
        store_id: "store-1",
      })

      expect(result.validationErrors).toBeDefined()
    })

    it("rejects empty store_id", async () => {
      const result = await createProduct({
        name: "Widget",
        store_id: "",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })
})
