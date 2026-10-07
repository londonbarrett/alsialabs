import { describe, it, expect } from "vitest"
import type { ExpenseWithCategory } from "@/lib/types"
import { expenseReducer } from "./expense-reducer"
import { createExpensesStore } from "./expense-store"

function makeExpense(
  overrides: Partial<ExpenseWithCategory> = {}
): ExpenseWithCategory {
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

describe("expenseReducer", () => {
  const a = makeExpense({ id: "a", description: "A" })
  const b = makeExpense({ id: "b", description: "B" })

  it("adds expense to front", () => {
    expect(expenseReducer([a], { type: "add", expense: b })).toEqual([
      b,
      a,
    ])
  })

  it("updates expense", () => {
    const updated = makeExpense({ id: "a", description: "New" })
    expect(
      expenseReducer([a, b], { type: "update", expense: updated })[0]
        .description
    ).toBe("New")
  })

  it("replaces temp", () => {
    const temp = makeExpense({ id: "temp-1" })
    const real = makeExpense({ id: "real-1" })
    expect(
      expenseReducer([temp, a], {
        type: "replaceTemp",
        tempId: "temp-1",
        expense: real,
      })
    ).toEqual([real, a])
  })

  it("deletes expense", () => {
    expect(
      expenseReducer([a, b], { type: "delete", expenseId: "a" })
    ).toEqual([b])
  })
})

describe("createExpensesStore", () => {
  it("seeds committed and optimistic from server props", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore([a, b])
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().optimistic).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("pend leaves committed untouched; commit applies the action", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore([a])
    const id = store.getState().pend({ type: "add", expense: b })
    expect(store.getState().committed).toEqual([a])
    expect(store.getState().optimistic[0].id).toBe("b")
    store.getState().commit(id)
    expect(store.getState().committed[0].id).toBe("b")
    expect(store.getState().pending).toHaveLength(0)
  })

  it("commit supports a replacement action", () => {
    const a = makeExpense({ id: "a" })
    const temp = makeExpense({ id: "temp-1" })
    const real = makeExpense({ id: "real-1" })
    const store = createExpensesStore([a])
    const id = store.getState().pend({ type: "add", expense: temp })
    store.getState().commit(id, {
      type: "replaceTemp",
      tempId: "temp-1",
      expense: real,
    })
    expect(store.getState().committed).toEqual([real, a])
  })

  it("discard reverts the pending action", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore([a, b])
    const id = store.getState().pend({ type: "delete", expenseId: "a" })
    store.getState().discard(id)
    expect(store.getState().committed).toEqual([a, b])
    expect(store.getState().pending).toHaveLength(0)
  })

  it("reseedFromServer replaces the whole committed list", () => {
    const a = makeExpense({ id: "a" })
    const b = makeExpense({ id: "b" })
    const store = createExpensesStore([a])
    store.getState().reseedFromServer([b])
    expect(store.getState().committed).toEqual([b])
    expect(store.getState().optimistic).toEqual([b])
  })
})
