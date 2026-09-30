import { describe, it, expect } from "vitest"
import { createInvoiceStore, invoiceReducer } from "./invoice-store"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"

function makeInvoice(
  overrides: Partial<InvoiceWithClientName> = {}
): InvoiceWithClientName {
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

describe("invoiceReducer (via stores/invoice-store)", () => {
  const a = makeInvoice({ id: "a", invoiceNumber: "A" })
  const b = makeInvoice({ id: "b", invoiceNumber: "B" })

  it("adds invoice to front", () => {
    expect(invoiceReducer([a], { type: "add", invoice: b })).toEqual([
      b,
      a,
    ])
  })

  it("updates invoice", () => {
    const updated = makeInvoice({ id: "a", clientName: "New" })
    expect(
      invoiceReducer([a, b], { type: "update", invoice: updated })[0]
        .clientName
    ).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({
      id: "real-1",
      invoiceNumber: "ALSIA-REAL",
    })
    expect(
      invoiceReducer([temp, a], {
        type: "replaceTemp",
        tempId: "temp-1",
        invoice: real,
      })
    ).toEqual([real, a])
  })

  it("deletes invoice", () => {
    expect(
      invoiceReducer([a, b], { type: "delete", invoiceId: "a" })
    ).toEqual([b])
  })

  it("updates status", () => {
    expect(
      invoiceReducer([a], {
        type: "updateStatus",
        invoiceId: "a",
        status: "cancelled",
      })[0].status
    ).toBe("cancelled")
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

describe("invoiceReducer (via stores/invoice-store)", () => {
  const a = makeInvoice({ id: "a", invoiceNumber: "A" })
  const b = makeInvoice({ id: "b", invoiceNumber: "B" })

  it("adds invoice to front", () => {
    expect(invoiceReducer([a], { type: "add", invoice: b })).toEqual([
      b,
      a,
    ])
  })

  it("updates invoice", () => {
    const updated = makeInvoice({ id: "a", clientName: "New" })
    expect(
      invoiceReducer([a, b], { type: "update", invoice: updated })[0]
        .clientName
    ).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({
      id: "real-1",
      invoiceNumber: "ALSIA-REAL",
    })
    expect(
      invoiceReducer([temp, a], {
        type: "replaceTemp",
        tempId: "temp-1",
        invoice: real,
      })
    ).toEqual([real, a])
  })

  it("deletes invoice", () => {
    expect(
      invoiceReducer([a, b], { type: "delete", invoiceId: "a" })
    ).toEqual([b])
  })

  it("updates status", () => {
    expect(
      invoiceReducer([a], {
        type: "updateStatus",
        invoiceId: "a",
        status: "cancelled",
      })[0].status
    ).toBe("cancelled")
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

  it("invoiceReducer still exposed for backwards compat", () => {
    expect(
      invoiceReducer([a], { type: "delete", invoiceId: "a" })
    ).toEqual([])
  })
})

describe("createInvoiceStore (optimistic pending-actions)", () => {
  it("seeds committed from server props", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    const store = createInvoiceStore([a, b])
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().optimistic).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend leaves committed untouched; commit applies the action", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    const store = createInvoiceStore([a])
    const id = store.getState().pend({ type: "add", invoice: b })
    expect(store.getState().committed).toEqual([a])
    expect(store.getState().pending).toHaveLength(1)
    expect(store.getState().pending[0].action).toEqual({
      type: "add",
      invoice: b,
    })
    // optimistic equals applying the pending action eagerly
    expect(store.getState().optimistic[0].id).toBe("b")
    store.getState().commit(id)
    expect(store.getState().committed[0].id).toBe("b")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit supports a replacement action", () => {
    const a = makeInvoice({ id: "a" })
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({
      id: "real-1",
      invoiceNumber: "ALSIA-REAL",
    })
    const store = createInvoiceStore([a])
    const id = store.getState().pend({ type: "add", invoice: temp })
    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1",
      invoice: real,
    })
    expect(store.getState().committed).toEqual([real, a])
  })

  it("discard reverts pending without committing", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    const store = createInvoiceStore([a, b])
    const id = store.getState().pend({ type: "delete", invoiceId: "a" })
    store.getState().discard(id)
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend recordPayment then commit updates the invoice", () => {
    const a = makeInvoice({
      id: "a",
      status: "draft",
      paidAmount: "0.00",
    })
    const store = createInvoiceStore([a])
    const id = store.getState().pend({
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "50.00",
      status: "partially_paid",
    })
    store.getState().commit(id)
    const updated = store.getState().committed[0]
    expect(updated.paidAmount).toBe("50.00")
    expect(updated.status).toBe("partially_paid")
  })
})
