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
    expect(
      paymentReducer([a], {
        type: "addPayment",
        invoiceId: "inv-1",
        payment: b,
      })[0].id
    ).toBe("b")
  })

  it("updates payment", () => {
    const updated = makePayment({ id: "a", amount: "99.00" })
    expect(
      paymentReducer([a, b], {
        type: "updatePayment",
        invoiceId: "inv-1",
        payment: updated,
        paidAmount: "99.00",
        status: "partially_paid",
      }).find((p) => p.id === "a")?.amount
    ).toBe("99.00")
  })

  it("deletes payment", () => {
    expect(
      paymentReducer([a, b], {
        type: "deletePayment",
        invoiceId: "inv-1",
        paymentId: "a",
        paidAmount: "20.00",
        status: "partially_paid",
      })
    ).toEqual([b])
  })

  it("sets the list", () => {
    expect(
      paymentReducer([a], {
        type: "setPayments",
        invoiceId: "inv-1",
        payments: [b],
      })
    ).toEqual([b])
  })

  it("does not mutate other payments on update", () => {
    const result = paymentReducer([a, b], {
      type: "updatePayment",
      invoiceId: "inv-1",
      payment: makePayment({ id: "a", amount: "999.00" }),
      paidAmount: "999.00",
      status: "paid",
    })
    expect(result.find((p) => p.id === "b")?.amount).toBe("20.00")
  })
})
