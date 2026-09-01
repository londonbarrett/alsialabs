import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  hasPermission: vi.fn(),
}))

vi.mock("@/lib/actions/project-access", () => ({
  verifyProjectAccess: vi.fn(),
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
import { verifyProjectAccess } from "@/lib/actions/project-access"
import {
  getExpenseCategories,
  getExpensesByProjectId,
  createExpense,
  updateExpense,
  deleteExpense,
} from "@/lib/actions/expenses"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockVerifyProjectAccess = vi.mocked(verifyProjectAccess)

const PROJECT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00"
const EXPENSE_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const CATEGORY_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"

function grantAccess() {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: true,
    isOwner: true,
  })
}

function denyAccess() {
  mockVerifyProjectAccess.mockResolvedValue({
    hasAccess: false,
    isOwner: false,
  })
}

describe("expenses actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", name: "Test" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
    grantAccess()
  })

  describe("getExpenseCategories", () => {
    it("returns expense taxonomy categories", async () => {
      const fakeCategories = [
        { id: CATEGORY_ID, slug: "supplies", name: "Supplies" },
        { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33", slug: "labor", name: "Labor" },
      ]
      state.mock.onSelect(schema.categoryTable).respond(fakeCategories)

      const result = await getExpenseCategories()

      expect(result.data).toEqual(fakeCategories)
    })

    it("rejects unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null)

      const result = await getExpenseCategories()

      expect(result.serverError).toEqual({ code: "UNAUTHORIZED" })
    })
  })

  describe("getExpensesByProjectId", () => {
    it("returns expenses for an accessible project", async () => {
      const fakeExpenses = [
        {
          id: EXPENSE_ID,
          projectId: PROJECT_ID,
          categoryId: CATEGORY_ID,
          description: "Fertilizer",
          amount: "120.00",
          expenseDate: "2026-08-01",
          createdAt: new Date(),
          updatedAt: new Date(),
          categoryName: "Supplies",
          categorySlug: "supplies",
        },
      ]
      state.mock.onSelect(schema.expensesTable).respond(fakeExpenses)

      const result = await getExpensesByProjectId({ projectId: PROJECT_ID })

      expect(result.data).toEqual(fakeExpenses)
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "expenses",
        "view"
      )
    })

    it("returns FORBIDDEN when access is denied", async () => {
      denyAccess()

      const result = await getExpensesByProjectId({ projectId: PROJECT_ID })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("createExpense", () => {
    it("creates an expense with valid data", async () => {
      state.mock.onInsert(schema.expensesTable).respond([])

      const result = await createExpense({
        projectId: PROJECT_ID,
        description: "Fertilizer",
        categoryId: CATEGORY_ID,
        amount: "120.00",
        expenseDate: "2026-08-01",
      })

      expect(result.serverError).toBeUndefined()
      expect(mockVerifyProjectAccess).toHaveBeenCalledWith(
        PROJECT_ID,
        "user-1",
        "user"
      )
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "expenses",
        "create"
      )
    })

    it("returns FORBIDDEN when access is denied", async () => {
      denyAccess()

      const result = await createExpense({
        projectId: PROJECT_ID,
        description: "Fertilizer",
        categoryId: CATEGORY_ID,
        amount: "120.00",
        expenseDate: "2026-08-01",
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })

    it("rejects missing required fields", async () => {
      const result = await createExpense({
        projectId: PROJECT_ID,
        description: "",
        categoryId: "",
        amount: "",
        expenseDate: "",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateExpense", () => {
    it("updates an existing expense", async () => {
      state.mock.onUpdate(schema.expensesTable).respond([{ id: EXPENSE_ID }])

      const result = await updateExpense({
        projectId: PROJECT_ID,
        id: EXPENSE_ID,
        description: "Updated",
        categoryId: CATEGORY_ID,
        amount: "140.00",
        expenseDate: "2026-08-02",
      })

      expect(result.serverError).toBeUndefined()
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "expenses",
        "edit"
      )
    })

    it("returns NOT_FOUND when expense does not exist", async () => {
      state.mock.onUpdate(schema.expensesTable).respond([])

      const result = await updateExpense({
        projectId: PROJECT_ID,
        id: EXPENSE_ID,
        description: "Updated",
        categoryId: CATEGORY_ID,
        amount: "140.00",
        expenseDate: "2026-08-02",
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("deleteExpense", () => {
    it("deletes an existing expense", async () => {
      state.mock
        .onDelete(schema.expensesTable)
        .respond([{ id: EXPENSE_ID }])

      const result = await deleteExpense({
        projectId: PROJECT_ID,
        id: EXPENSE_ID,
      })

      expect(result.serverError).toBeUndefined()
      expect(mockHasPermission).toHaveBeenCalledWith(
        "user-1",
        "expenses",
        "delete"
      )
    })

    it("returns NOT_FOUND when expense does not exist", async () => {
      state.mock.onDelete(schema.expensesTable).respond([])

      const result = await deleteExpense({
        projectId: PROJECT_ID,
        id: EXPENSE_ID,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })
})
