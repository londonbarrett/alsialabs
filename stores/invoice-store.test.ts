import { describe, it, expect, beforeEach } from "vitest"
import { applyInvoiceAction, invoiceReducer, useInvoiceStore } from "./invoice-store"
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

describe("invoiceReducer (via stores/invoice-store)", () => {
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

describe("applyInvoiceAction (via stores/invoice-store)", () => {
  const a = makeInvoice({ id: "a", invoiceNumber: "A" })
  const b = makeInvoice({ id: "b", invoiceNumber: "B" })

  it("adds invoice to front", () => {
    expect(applyInvoiceAction([a], undefined, { type: "add", invoice: b })).toEqual([b, a])
  })

  it("updates invoice", () => {
    const updated = makeInvoice({ id: "a", clientName: "New" })
    expect(applyInvoiceAction([a, b], undefined, { type: "update", invoice: updated })[0].clientName).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({ id: "real-1", invoiceNumber: "ALSIA-REAL" })
    expect(applyInvoiceAction([temp, a], undefined, { type: "replaceTemp", tempId: "temp-1", invoice: real })).toEqual([real, a])
  })

  it("deletes invoice", () => {
    expect(applyInvoiceAction([a, b], undefined, { type: "delete", invoiceId: "a" })).toEqual([b])
  })

  it("resets list", () => {
    expect(applyInvoiceAction([a], undefined, { type: "reset", invoices: [b] })).toEqual([b])
  })

  it("updates status", () => {
    expect(applyInvoiceAction([a], undefined, { type: "updateStatus", invoiceId: "a", status: "cancelled" })[0].status).toBe("cancelled")
  })

  it("records payment updates paidAmount and status", () => {
    const result = applyInvoiceAction([a], undefined, {
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "50.00",
      status: "partially_paid",
    })
    expect(result[0].paidAmount).toBe("50.00")
    expect(result[0].status).toBe("partially_paid")
  })

  it("recordPayment does not affect other invoices", () => {
    const result = applyInvoiceAction([a, b], undefined, {
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "100.00",
      status: "paid",
    })
    expect(result.find((x) => x.id === "b")?.status).toBe("draft")
  })

  it("invoiceReducer still exposed for backwards compat", () => {
    expect(invoiceReducer([a], { type: "delete", invoiceId: "a" })).toEqual([])
  })
})

describe("useInvoiceStore (optimistic pending-actions)", () => {
  beforeEach(() => {
    useInvoiceStore.getState().reset()
  })

  it("hydrates from server props", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    useInvoiceStore.getState().hydrate([a, b])
    expect(useInvoiceStore.getState().committed).toEqual([a, b])
    expect(useInvoiceStore.getState().pending).toHaveLength(0)
  })

  it("pend makes the action globally visible; commit applies it to committed", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    useInvoiceStore.getState().hydrate([a])
    const id = useInvoiceStore.getState().pend({ type: "add", invoice: b })
    // While pending, committed is untouched but pending exposes the action
    expect(useInvoiceStore.getState().committed).toEqual([a])
    expect(useInvoiceStore.getState().pending).toHaveLength(1)
    expect(useInvoiceStore.getState().pending[0].action).toEqual({ type: "add", invoice: b })
    // Derive equals applying the pending action eagerly
    const derived = useInvoiceStore
      .getState()
      .pending.reduce(
        (acc, item) => applyInvoiceAction(acc, item.key, item.action),
        useInvoiceStore.getState().committed
      )
    expect(derived[0].id).toBe("b")
    useInvoiceStore.getState().commit(id)
    expect(useInvoiceStore.getState().committed[0].id).toBe("b")
    expect(useInvoiceStore.getState().pending).toHaveLength(0)
  })

  it("commit supports a replacement action", () => {
    const a = makeInvoice({ id: "a" })
    const temp = makeInvoice({ id: "temp-1" })
    const real = makeInvoice({ id: "real-1", invoiceNumber: "ALSIA-REAL" })
    useInvoiceStore.getState().hydrate([a])
    const id = useInvoiceStore.getState().pend({ type: "add", invoice: temp })
    useInvoiceStore.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1",
      invoice: real,
    })
    expect(useInvoiceStore.getState().committed).toEqual([real, a])
  })

  it("discard reverts pending without committing", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    useInvoiceStore.getState().hydrate([a, b])
    const id = useInvoiceStore.getState().pend({ type: "delete", invoiceId: "a" })
    useInvoiceStore.getState().discard(id)
    expect(useInvoiceStore.getState().committed).toEqual([a, b])
    expect(useInvoiceStore.getState().pending).toHaveLength(0)
  })

  it("pend recordPayment then commit updates the invoice globally", () => {
    const a = makeInvoice({ id: "a", status: "draft", paidAmount: "0.00" })
    useInvoiceStore.getState().hydrate([a])
    const id = useInvoiceStore.getState().pend({
      type: "recordPayment",
      invoiceId: "a",
      paidAmount: "50.00",
      status: "partially_paid",
    })
    useInvoiceStore.getState().commit(id)
    const updated = useInvoiceStore.getState().committed[0]
    expect(updated.paidAmount).toBe("50.00")
    expect(updated.status).toBe("partially_paid")
  })

  it("hydrate is skipped while an action is pending", () => {
    const a = makeInvoice({ id: "a" })
    const b = makeInvoice({ id: "b" })
    useInvoiceStore.getState().hydrate([a])
    const id = useInvoiceStore.getState().pend({ type: "add", invoice: b })
    useInvoiceStore.getState().hydrate([a])
    expect(useInvoiceStore.getState().committed).toEqual([a])
    expect(useInvoiceStore.getState().pending).toHaveLength(1)
    useInvoiceStore.getState().commit(id)
    useInvoiceStore.getState().hydrate([a, b])
    expect(useInvoiceStore.getState().committed).toEqual([a, b])
  })

  it("reset clears committed and pending", () => {
    const a = makeInvoice({ id: "a" })
    useInvoiceStore.getState().hydrate([a])
    useInvoiceStore.getState().pend({ type: "delete", invoiceId: "a" })
    useInvoiceStore.getState().reset()
    expect(useInvoiceStore.getState().committed).toEqual([])
    expect(useInvoiceStore.getState().pending).toHaveLength(0)
  })
})
