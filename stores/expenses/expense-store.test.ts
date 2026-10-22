import { describe, it, expect } from "vitest"
import type { ExpenseWithCategoryDTO } from "@/actions/schemas/expense"
import type { ProjectInvoiceDTO } from "@/actions/schemas/invoice"
import { expenseReducer } from "./expense-reducer"
import { createExpensesStore } from "./expense-store"

function makeExpense(
  overrides: Partial<ExpenseWithCategoryDTO> = {}
): ExpenseWithCategoryDTO {
  return {
    id: "exp-1",
    projectId: "project-1",
    categoryId: "cat-1",
    description: "Materials",
    amount: "100.00",
    expenseDate: "2024-01-15",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    categoryName: "Supplies",
    categorySlug: "supplies",
    ...overrides,
  }
}

function makeInvoice(
  overrides: Partial<ProjectInvoiceDTO> = {}
): ProjectInvoiceDTO {
  return {
    id: "inv-1",
    invoiceNumber: "INV-001",
    status: "paid",
    paidAmount: "100.00",
    issueDate: "2024-01-10",
    ...overrides,
  }
}

describe("expenseReducer", () => {
  const a = makeExpense({ id: "a", description: "A" })
  const b = makeExpense({ id: "b", description: "B" })

  it("adds expense to front", () => {
    const next = expenseReducer(
      { expenses: [a], invoices: [] },
      { type: "add", expense: b }
    )
    expect(next.expenses).toEqual([b, a])
    expect(next.invoices).toEqual([])
  })

  it("updates expense", () => {
    const updated = makeExpense({ id: "a", description: "New" })
    const next = expenseReducer(
      { expenses: [a, b], invoices: [] },
      { type: "update", expense: updated }
    )
    expect(next.expenses[0].description).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeExpense({ id: "temp-1" })
    const real = makeExpense({ id: "real-1" })
    const next = expenseReducer(
      { expenses: [temp, a], invoices: [] },
      { type: "replaceTemp", tempId: "temp-1", expense: real }
    )
    expect(next.expenses).toEqual([real, a])
  })

  it("deletes expense", () => {
    const next = expenseReducer(
      { expenses: [a, b], invoices: [] },
      { type: "delete", expenseId: "a" }
    )
    expect(next.expenses).toEqual([b])
  })

  it("leaves invoices untouched", () => {
    const inv = makeInvoice()
    const next = expenseReducer(
      { expenses: [a], invoices: [inv] },
      { type: "add", expense: b }
    )
    expect(next.invoices).toEqual([inv])
  })

  it("unbindInvoice removes the matching invoice, leaves expenses and other invoices untouched", () => {
    const inv1 = makeInvoice({ id: "inv-1" })
    const inv2 = makeInvoice({ id: "inv-2", invoiceNumber: "INV-002" })
    const next = expenseReducer(
      { expenses: [a, b], invoices: [inv1, inv2] },
      { type: "unbindInvoice", invoiceId: "inv-1" }
    )
    expect(next.invoices).toEqual([inv2])
    expect(next.expenses).toEqual([a, b])
  })
})

describe("createExpensesStore", () => {
  it("seeds committed and optimistic from server props", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const inv = makeInvoice()
    const seed = { expenses: [a, b], invoices: [inv] }
    const store = createExpensesStore(seed)
    expect(store.getState().committed).toEqual(seed)
    expect(store.getState().optimistic).toEqual(seed)
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend leaves committed untouched; commit applies the action", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore({ expenses: [a], invoices: [] })
    const id = store.getState().pend({ type: "add", expense: b })
    expect(store.getState().committed.expenses).toEqual([a])
    expect(store.getState().optimistic.expenses[0].id).toBe("b")
    store.getState().commit(id)
    expect(store.getState().committed.expenses[0].id).toBe("b")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit supports a replacement action", () => {
    const a = makeExpense({ id: "a" })
    const temp = makeExpense({ id: "temp-1" })
    const real = makeExpense({ id: "real-1" })
    const store = createExpensesStore({ expenses: [a], invoices: [] })
    const id = store.getState().pend({ type: "add", expense: temp })
    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1",
      expense: real,
    })
    expect(store.getState().committed.expenses).toEqual([real, a])
  })

  it("discard reverts the pending action", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore({
      expenses: [a, b],
      invoices: [],
    })
    const id = store.getState().pend({ type: "delete", expenseId: "a" })
    store.getState().discard(id)
    expect(store.getState().committed.expenses).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend unbindInvoice removes the row optimistically; discard restores it", () => {
    const inv1 = makeInvoice({ id: "inv-1" })
    const inv2 = makeInvoice({ id: "inv-2", invoiceNumber: "INV-002" })
    const store = createExpensesStore({
      expenses: [],
      invoices: [inv1, inv2],
    })
    const id = store.getState().pend({
      type: "unbindInvoice",
      invoiceId: "inv-1",
    })
    expect(store.getState().optimistic.invoices).toEqual([inv2])
    expect(store.getState().committed.invoices).toEqual([inv1, inv2])

    store.getState().discard(id)

    expect(store.getState().committed.invoices).toEqual([inv1, inv2])
    expect(store.getState().optimistic.invoices).toEqual([inv1, inv2])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("reseedFromServer replaces both server lists", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const inv1 = makeInvoice({ id: "inv-1" })
    const inv2 = makeInvoice({ id: "inv-2", invoiceNumber: "INV-002" })
    const store = createExpensesStore({
      expenses: [a],
      invoices: [inv1],
    })
    store
      .getState()
      .reseedFromServer({ expenses: [b], invoices: [inv2] })
    expect(store.getState().committed).toEqual({
      expenses: [b],
      invoices: [inv2],
    })
    expect(store.getState().optimistic).toEqual({
      expenses: [b],
      invoices: [inv2],
    })
  })
})
