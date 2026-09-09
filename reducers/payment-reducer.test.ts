import { describe, it, expect } from "vitest"
import { paymentReducer } from "./payment-reducer"
import type { InvoicePayment } from "@/lib/drizzle/schema"

function makePayment(overrides: Partial<InvoicePayment> = {}): InvoicePayment {
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

describe("paymentReducer", () => {
  const a = makePayment({ id: "a", amount: "10.00" })
  const b = makePayment({ id: "b", amount: "20.00" })

  it("adds payment to front", () => {
    expect(paymentReducer([a], { type: "add", payment: b })[0].id).toBe("b")
  })

  it("updates payment", () => {
    const updated = makePayment({ id: "a", amount: "99.00" })
    expect(paymentReducer([a, b], { type: "update", payment: updated }).find((p) => p.id === "a")?.amount).toBe("99.00")
  })

  it("replaces temp", () => {
    const temp = makePayment({ id: "temp-1", amount: "5.00" })
    const real = makePayment({ id: "real-1", amount: "5.00" })
    const result = paymentReducer([temp], { type: "replaceTemp", tempId: "temp-1", payment: real })
    expect(result[0].id).toBe("real-1")
  })

  it("deletes payment", () => {
    expect(paymentReducer([a, b], { type: "delete", paymentId: "a" })).toEqual([b])
  })

  it("resets list", () => {
    expect(paymentReducer([a], { type: "reset", payments: [b] })).toEqual([b])
  })

  it("does not mutate other payments on update", () => {
    const result = paymentReducer([a, b], { type: "update", payment: makePayment({ id: "a", amount: "999.00" }) })
    expect(result.find((p) => p.id === "b")?.amount).toBe("20.00")
  })
})
