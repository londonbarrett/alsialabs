import { describe, it, expect } from "vitest"
import { createInvoiceStore } from "./invoice-store"
import { invoiceReducer } from "./invoice-reducer"
import type { InvoiceWithClientName } from "@/components/sales/sales-invoice-table"
import type { InvoicePayment } from "@/lib/drizzle/schema"

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

function makePayment(
  overrides: Partial<InvoicePayment> = {}
): InvoicePayment {
  return {
    id: "pay-1",
    invoiceId: "inv-1",
    amount: "50.00",
    paymentDate: "2024-01-20",
    method: "cash",
    reference: null,
    notes: null,
    userId: "user-1",
    createdAt: new Date("2024-01-20"),
    ...overrides,
  } as InvoicePayment
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
    expect(store.getState().committed.invoices).toEqual([a, b])
    expect(store.getState().optimistic.invoices).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend leaves committed untouched; commit applies the action", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    const store = createInvoiceStore([a])
    const id = store.getState().pend({ type: "add", invoice: b })
    expect(store.getState().committed.invoices).toEqual([a])
    expect(store.getState().pending).toHaveLength(1)
    expect(store.getState().pending[0].action).toEqual({
      type: "add",
      invoice: b,
    })
    // optimistic equals applying the pending action eagerly
    expect(store.getState().optimistic.invoices[0].id).toBe("b")
    store.getState().commit(id)
    expect(store.getState().committed.invoices[0].id).toBe("b")
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
    expect(store.getState().committed.invoices).toEqual([real, a])
  })

  it("discard reverts pending without committing", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    const store = createInvoiceStore([a, b])
    const id = store.getState().pend({ type: "delete", invoiceId: "a" })
    store.getState().discard(id)
    expect(store.getState().committed.invoices).toEqual([a, b])
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
    const updated = store.getState().committed.invoices[0]
    expect(updated.paidAmount).toBe("50.00")
    expect(updated.status).toBe("partially_paid")
  })

  it("setPayments seeds the per-invoice payment list", () => {
    const a = makeInvoice({ id: "a" })
    const store = createInvoiceStore([a])
    const payment = makePayment({ invoiceId: "a" })
    const id = store.getState().pend({
      type: "setPayments",
      invoiceId: "a",
      payments: [payment],
    })
    store.getState().commit(id)
    expect(store.getState().committed.paymentsByInvoiceId.a).toEqual([
      payment,
    ])
  })

  it("updatePayment patches the payment list and the invoice", () => {
    const a = makeInvoice({ id: "a", paidAmount: "10.00" })
    const store = createInvoiceStore([a])
    const seed = store.getState().pend({
      type: "setPayments",
      invoiceId: "a",
      payments: [
        makePayment({ id: "p1", invoiceId: "a", amount: "10.00" }),
      ],
    })
    store.getState().commit(seed)

    const id = store.getState().pend({
      type: "updatePayment",
      invoiceId: "a",
      payment: makePayment({
        id: "p1",
        invoiceId: "a",
        amount: "40.00",
      }),
      paidAmount: "40.00",
      status: "partially_paid",
    })
    store.getState().commit(id)

    expect(
      store.getState().committed.paymentsByInvoiceId.a[0].amount
    ).toBe("40.00")
    expect(store.getState().committed.invoices[0].paidAmount).toBe(
      "40.00"
    )
    expect(store.getState().committed.invoices[0].status).toBe(
      "partially_paid"
    )
  })

  it("deletePayment removes the payment and patches the invoice", () => {
    const a = makeInvoice({ id: "a", paidAmount: "10.00" })
    const store = createInvoiceStore([a])
    const seed = store.getState().pend({
      type: "setPayments",
      invoiceId: "a",
      payments: [
        makePayment({ id: "p1", invoiceId: "a", amount: "10.00" }),
      ],
    })
    store.getState().commit(seed)

    const id = store.getState().pend({
      type: "deletePayment",
      invoiceId: "a",
      paymentId: "p1",
      paidAmount: "0.00",
      status: "draft",
    })
    store.getState().commit(id)

    expect(store.getState().committed.paymentsByInvoiceId.a).toEqual([])
    expect(store.getState().committed.invoices[0].paidAmount).toBe(
      "0.00"
    )
    expect(store.getState().committed.invoices[0].status).toBe("draft")
  })
})
