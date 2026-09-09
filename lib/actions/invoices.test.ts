import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { getEffectiveStoreId } from "@/lib/actions/stores"
import { auth, hasPermission } from "@/lib/auth"
import * as schema from "@/lib/drizzle/schema"
import {
  cancelInvoice,
  createInvoice,
  deleteInvoice,
  getClientInvoices,
  getInvoices,
  getMyInvoiceDetails,
  getMyInvoices,
  updateInvoice,
} from "./invoices"

const mockAuth = vi.mocked(auth) as unknown as ReturnType<typeof vi.fn>
const mockHasPermission = vi.mocked(hasPermission)
const mockGetEffectiveStoreId = vi.mocked(getEffectiveStoreId)

const USER_ID = "user-1"
const CLIENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
const INVOICE_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
const STORE_ID = "store-1"
const INVOICE_NUMBER = "ALSIA-TEST123"

const validInvoiceData = {
  type: "product" as const,
  clientId: CLIENT_ID,
  issueDate: "2024-01-15",
  dueDate: "2024-02-15",
  paidAmount: "0",
  notes: "Test notes",
  items: [
    {
      description: "Item 1",
      quantity: "2",
      unitPrice: "100.00",
      discountPercent: "0",
      taxPercent: "10",
      productId: null,
    },
  ],
}

describe("invoices actions", () => {
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
    mockGetEffectiveStoreId.mockResolvedValue(STORE_ID)
  })

  describe("getClientInvoices", () => {
    it("returns invoices for client", async () => {
      state.mock
        .onSelect(schema.clientsTable)
        .respond([{ id: CLIENT_ID }])
      state.mock.onSelect(schema.invoicesTable).respond([
        {
          id: INVOICE_ID,
          type: "product",
          invoiceNumber: INVOICE_NUMBER,
          clientId: CLIENT_ID,
          status: "draft",
          issueDate: "2024-01-15",
          notes: null,
          subtotal: "200.00",
          discountTotal: "0",
          taxTotal: "20.00",
          grandTotal: "220.00",
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await getClientInvoices({ clientId: CLIENT_ID })

      expect(result.data).toBeDefined()
      expect(result.serverError).toBeUndefined()
    })

    it("returns FORBIDDEN when user does not own client", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: USER_ID,
          role: "user",
          name: "Test",
          email: "test@test.com",
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      })
      state.mock.onSelect(schema.clientsTable).respond([])

      const result = await getClientInvoices({ clientId: CLIENT_ID })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("getMyInvoices", () => {
    it("returns invoices for current user", async () => {
      state.mock
        .onSelect(schema.clientsTable)
        .respond([{ id: CLIENT_ID }])
      state.mock.onSelect(schema.invoicesTable).respond([
        {
          id: INVOICE_ID,
          store_id: STORE_ID,
          type: "product",
          invoiceNumber: INVOICE_NUMBER,
          clientId: CLIENT_ID,
          userId: USER_ID,
          status: "draft",
          issueDate: "2024-01-15",
          dueDate: null,
          paidAmount: "0",
          notes: null,
          subtotal: "100",
          discountTotal: "0",
          taxTotal: "0",
          grandTotal: "100",
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          outstandingBalance: "100",
        },
      ])

      const result = await getMyInvoices()

      expect(result.data).toBeDefined()
    })

    it("returns empty when no client found", async () => {
      state.mock.onSelect(schema.clientsTable).respond([])

      const result = await getMyInvoices()

      expect(result.data?.invoices).toEqual([])
      expect(result.data?.clientId).toBeNull()
    })
  })

  describe("getMyInvoiceDetails", () => {
    it("returns invoice details", async () => {
      state.mock
        .onSelect(schema.clientsTable)
        .respond([{ id: CLIENT_ID }])
      state.mock.onSelect(schema.invoicesTable).respond([
        {
          id: INVOICE_ID,
          store_id: STORE_ID,
          type: "product",
          invoiceNumber: INVOICE_NUMBER,
          clientId: CLIENT_ID,
          userId: USER_ID,
          status: "draft",
          issueDate: "2024-01-15",
          dueDate: null,
          paidAmount: "0",
          notes: null,
          subtotal: "100",
          discountTotal: "0",
          taxTotal: "0",
          grandTotal: "100",
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          outstandingBalance: "100",
        },
      ])
      state.mock.onSelect(schema.invoiceItemsTable).respond([])
      state.mock.onSelect(schema.invoicePaymentsTable).respond([])

      const result = await getMyInvoiceDetails({
        invoiceId: INVOICE_ID,
      })

      expect(result.data).toBeDefined()
    })

    it("returns FORBIDDEN when no client", async () => {
      state.mock.onSelect(schema.clientsTable).respond([])

      const result = await getMyInvoiceDetails({
        invoiceId: INVOICE_ID,
      })

      expect(result.serverError).toEqual({ code: "FORBIDDEN" })
    })
  })

  describe("getInvoices", () => {
    it("returns invoices list", async () => {
      const fakeInvoices = [
        {
          id: INVOICE_ID,
          store_id: STORE_ID,
          type: "product",
          invoiceNumber: INVOICE_NUMBER,
          clientId: CLIENT_ID,
          userId: USER_ID,
          clientName: "Test Client",
          status: "draft",
          issueDate: "2024-01-15",
          dueDate: null,
          notes: null,
          subtotal: "100",
          discountTotal: "0",
          taxTotal: "0",
          grandTotal: "100",
          paidAmount: "0",
          outstandingBalance: "100",
          projectId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]
      state.mock.onSelect(schema.invoicesTable).respond(fakeInvoices)

      const result = await getInvoices()

      expect(result.data).toBeDefined()
    })

    it("derives overdue status", async () => {
      const overdueInvoice = {
        id: INVOICE_ID,
        store_id: STORE_ID,
        type: "product",
        invoiceNumber: INVOICE_NUMBER,
        clientId: CLIENT_ID,
        userId: USER_ID,
        clientName: "Test",
        status: "sent",
        issueDate: "2024-01-15",
        dueDate: "2020-01-01",
        notes: null,
        subtotal: "100",
        discountTotal: "0",
        taxTotal: "0",
        grandTotal: "100",
        paidAmount: "0",
        outstandingBalance: "100",
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock
        .onSelect(schema.invoicesTable)
        .respond([overdueInvoice])

      const result = await getInvoices()

      expect(result.data?.[0].status).toBe("overdue")
    })
  })

  describe("createInvoice", () => {
    it("creates invoice with valid data", async () => {
      const created = {
        id: INVOICE_ID,
        type: "product",
        invoiceNumber: INVOICE_NUMBER,
        clientId: CLIENT_ID,
        userId: USER_ID,
        status: "draft",
        issueDate: "2024-01-15",
        dueDate: null,
        paidAmount: "0",
        notes: null,
        subtotal: "200.00",
        discountTotal: "0",
        taxTotal: "20.00",
        grandTotal: "220.00",
        store_id: STORE_ID,
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock.onInsert(schema.invoicesTable).respond([created])
      state.mock
        .onInsert(schema.invoiceItemsTable)
        .respond([{ id: "item-1" }])

      const result = await createInvoice(validInvoiceData)

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it("creates invoice with initial payment", async () => {
      const dataWithPayment = {
        ...validInvoiceData,
        paidAmount: "100.00",
      }
      const created = {
        id: INVOICE_ID,
        type: "product",
        invoiceNumber: INVOICE_NUMBER,
        clientId: CLIENT_ID,
        userId: USER_ID,
        status: "partially_paid",
        issueDate: "2024-01-15",
        dueDate: null,
        paidAmount: "100.00",
        notes: null,
        subtotal: "200.00",
        discountTotal: "0",
        taxTotal: "20.00",
        grandTotal: "220.00",
        store_id: STORE_ID,
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock.onInsert(schema.invoicesTable).respond([created])
      state.mock
        .onInsert(schema.invoicePaymentsTable)
        .respond([{ id: "pay-1" }])
      state.mock
        .onInsert(schema.invoiceItemsTable)
        .respond([{ id: "item-1" }])

      const result = await createInvoice(dataWithPayment)

      expect(result.data).toBeDefined()
    })

    it("rejects invalid data", async () => {
      const result = await createInvoice({
        type: "product",
        clientId: "",
        issueDate: "",
        dueDate: "",
        paidAmount: "0",
        notes: "",
        items: [],
      })

      expect(result.validationErrors).toBeDefined()
    })
  })

  describe("updateInvoice", () => {
    it("updates invoice with valid data", async () => {
      const updated = {
        id: INVOICE_ID,
        type: "product",
        invoiceNumber: INVOICE_NUMBER,
        clientId: CLIENT_ID,
        userId: USER_ID,
        status: "draft",
        issueDate: "2024-01-15",
        dueDate: null,
        paidAmount: "0",
        notes: null,
        subtotal: "200.00",
        discountTotal: "0",
        taxTotal: "20.00",
        grandTotal: "220.00",
        store_id: STORE_ID,
        projectId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      state.mock.onUpdate(schema.invoicesTable).respond([updated])
      state.mock.onDelete(schema.invoiceItemsTable).respond([])
      state.mock
        .onInsert(schema.invoiceItemsTable)
        .respond([{ id: "item-1" }])

      const result = await updateInvoice({
        invoiceId: INVOICE_ID,
        ...validInvoiceData,
      })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toBeDefined()
    })

    it("returns NOT_FOUND when invoice does not exist", async () => {
      state.mock.onUpdate(schema.invoicesTable).respond([])

      const result = await updateInvoice({
        invoiceId: INVOICE_ID,
        ...validInvoiceData,
      })

      expect(result.serverError).toEqual({ code: "NOT_FOUND" })
    })
  })

  describe("cancelInvoice", () => {
    it("cancels invoice", async () => {
      state.mock
        .onUpdate(schema.invoicesTable)
        .respond([{ id: INVOICE_ID }])

      const result = await cancelInvoice({ invoiceId: INVOICE_ID })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual({ success: true })
    })
  })

  describe("deleteInvoice", () => {
    it("deletes invoice", async () => {
      state.mock
        .onDelete(schema.invoicesTable)
        .respond([{ id: INVOICE_ID }])

      const result = await deleteInvoice({ invoiceId: INVOICE_ID })

      expect(result.serverError).toBeUndefined()
      expect(result.data).toEqual({ success: true })
    })

    it("returns CANNOT_DELETE_INVOICE on failure", async () => {
      const { db } = await import("@/lib/drizzle/client")
      vi.spyOn(db, "delete").mockImplementationOnce((): never => {
        throw new Error("FK violation")
      })

      const result = await deleteInvoice({ invoiceId: INVOICE_ID })

      expect(result.serverError).toEqual({
        code: "CANNOT_DELETE_INVOICE",
      })
    })
  })
})
