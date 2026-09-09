import { describe, it, expect } from "vitest"
import { invoiceReducer } from "./invoice-reducer"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"

function makeInvoice(overrides: Partial<InvoiceWithClientName> = {}): InvoiceWithClientName {
  return {
    id: "inv-1",
    store_id: "store-1",
    type: "product",
    invoiceNumber: "ALSIA-TEST",
    clientId: "client-1",
    userId: "user-1",
    clientName: "Acme",
    status: "draft",
    issueDate: "2024-01-15",
    dueDate: null,
    notes: null,
    subtotal: "100.00",
    discountTotal: "0.00",
    taxTotal: "0.00",
    grandTotal: "100.00",
    paidAmount: "0.00",
    outstandingBalance: "100.00",
    projectId: null,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    ...overrides,
  } as InvoiceWithClientName
}

describe("invoiceReducer", () => {
  const a = makeInvoice({ id: "a", invoiceNumber: "A" })
  const b = makeInvoice({ id: "b", invoiceNumber: "B" })

  it("adds invoice to front", () => {
    expect(invoiceReducer([a], { type: "add", invoice: b })).toEqual([b, a])
  })

  it("updates invoice", () => {
    const updated = makeInvoice({ id: "a", clientName: "New" })
    expect(invoiceReducer([a, b], { type: "update", invoice: updated })[0].clientName).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({ id: "real-1", invoiceNumber: "ALSIA-REAL" })
    expect(invoiceReducer([temp, a], { type: "replaceTemp", tempId: "temp-1", invoice: real })).toEqual([real, a])
  })

  it("deletes invoice", () => {
    expect(invoiceReducer([a, b], { type: "delete", invoiceId: "a" })).toEqual([b])
  })

  it("resets list", () => {
    expect(invoiceReducer([a], { type: "reset", invoices: [b] })).toEqual([b])
  })

  it("updates status", () => {
    expect(invoiceReducer([a], { type: "updateStatus", invoiceId: "a", status: "cancelled" })[0].status).toBe("cancelled")
  })

  it("records payment updates paidAmount and status", () => {
    const result = invoiceReducer([a], {
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "50.00",
      status: "partially_paid",
    })
    expect(result[0].paidAmount).toBe("50.00")
    expect(result[0].status).toBe("partially_paid")
  })

  it("recordPayment does not affect other invoices", () => {
    const result = invoiceReducer([a, b], {
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "100.00",
      status: "paid",
    })
    expect(result.find((x) => x.id === "b")?.status).toBe("draft")
  })
})
