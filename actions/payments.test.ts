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
  const originalTransaction = (
    db as unknown as { transaction: unknown }
  ).transaction
  ;(db as unknown as { transaction: unknown }).transaction = vi.fn(
    async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb(db)
    }
  )
  return { db }
})

import * as schema from "@/lib/drizzle/schema"
import { auth, hasPermission } from "@/lib/auth"
import { recordPayment, updatePayment, deletePayment } from "./payments"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)

const INVOICE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
const PAYMENT_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33"
const USER_ID = "user-1"

const validPayment = {
  amount: "50.00",
  paymentDate: "2024-01-20",
  method: "cash",
  reference: "",
  notes: "",
}

describe("payments actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mock.resetMocks()
    mockAuth.mockResolvedValue({
      user: {
        id: USER_ID,
        role: "admin",
        name: "Test",
        email: "test@test.com",
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    })
    mockHasPermission.mockResolvedValue(true)
  })

  describe("recordPayment", () => {
    it("records payment with valid data", async () => {
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([
          { grandTotal: "100.00", paidAmount: "0", status: "draft" },
        ])
      state.mock
        .onUpdate(schema.invoicesTable)
        .respond([{ id: INVOICE_ID }])
      state.mock
        .onInsert(schema.invoicePaymentsTable)
        .respond([{ id: PAYMENT_ID }])

      const result = await recordPayment({
        invoiceId: INVOICE_ID,
        ...validPayment,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual({ success: true })
    })

    it("returns VALIDATION_FAILED when amount exceeds remaining", async () => {
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([
          {
            grandTotal: "100.00",
            paidAmount: "80.00",
            status: "draft",
          },
        ])

      const result = await recordPayment({
        invoiceId: INVOICE_ID,
        amount: "50.00",
        paymentDate: "2024-01-20",
        method: "",
        reference: "",
        notes: "",
      })

      expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
    })

    it("returns NOT_FOUND when invoice not found", async () => {
      state.mock.onSelect(schema.invoicesTable).respond([])

      const result = await recordPayment({
        invoiceId: INVOICE_ID,
        ...validPayment,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })

    it("returns VALIDATION_FAILED when invoice is cancelled", async () => {
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([
          {
            grandTotal: "100.00",
            paidAmount: "0",
            status: "cancelled",
          },
        ])

      const result = await recordPayment({
        invoiceId: INVOICE_ID,
        ...validPayment,
      })

      expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
    })

    it("rejects invalid data", async () => {
      const result = await recordPayment({
        invoiceId: INVOICE_ID,
        amount: "",
        paymentDate: "",
        method: "",
        reference: "",
        notes: "",
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updatePayment", () => {
    it("updates payment with valid data", async () => {
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ invoiceId: INVOICE_ID }])
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([{ grandTotal: "100.00" }])
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ total: "50.00" }])
      state.mock
        .onUpdate(schema.invoicePaymentsTable)
        .respond([{ id: PAYMENT_ID }])
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([{ grandTotal: "100.00", status: "draft" }])
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ total: "0" }])
      state.mock
        .onUpdate(schema.invoicesTable)
        .respond([{ id: INVOICE_ID }])

      const result = await updatePayment({
        paymentId: PAYMENT_ID,
        ...validPayment,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual({ success: true })
    })

    it("returns NOT_FOUND when payment not found", async () => {
      state.mock.onSelect(schema.invoicePaymentsTable).respond([])

      const result = await updatePayment({
        paymentId: PAYMENT_ID,
        ...validPayment,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })

    it("returns VALIDATION_FAILED when amount exceeds remaining", async () => {
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ invoiceId: INVOICE_ID }])
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([{ grandTotal: "100.00" }])
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ total: "80.00" }])

      const result = await updatePayment({
        paymentId: PAYMENT_ID,
        amount: "50.00",
        paymentDate: "2024-01-20",
        method: "",
        reference: "",
        notes: "",
      })

      expect(result.serverError).toEqual({ code: "VALIDATION_FAILED" })
    })
  })

  describe("deletePayment", () => {
    it("deletes payment", async () => {
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ invoiceId: INVOICE_ID }])
      state.mock
        .onDelete(schema.invoicePaymentsTable)
        .respond([{ id: PAYMENT_ID }])
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([{ grandTotal: "100.00", status: "draft" }])
      state.mock
        .onSelect(schema.invoicePaymentsTable)
        .respond([{ total: "0" }])
      state.mock
        .onUpdate(schema.invoicesTable)
        .respond([{ id: INVOICE_ID }])

      const result = await deletePayment({ paymentId: PAYMENT_ID })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual({ success: true })
    })

    it("returns NOT_FOUND when payment not found", async () => {
      state.mock.onSelect(schema.invoicePaymentsTable).respond([])

      const result = await deletePayment({ paymentId: PAYMENT_ID })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })
})
