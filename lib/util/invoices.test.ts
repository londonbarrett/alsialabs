import { describe, it, expect } from "vitest"
import { computeInvoiceTotals, computeLineTotal } from "./invoices"

describe("invoices utils", () => {
  describe("computeLineTotal", () => {
    it("computes total without discount/tax", () => {
      expect(computeLineTotal(2, 100, 0, 0)).toEqual({
        total: 200,
        discountAmount: 0,
        taxAmount: 0,
      })
    })

    it("computes discount and tax", () => {
      // 2 * 100 = 200, 10% discount = 20, taxable 180, 10% tax = 18, total 198
      expect(computeLineTotal(2, 100, 10, 10)).toEqual({
        total: 198,
        discountAmount: 20,
        taxAmount: 18,
      })
    })

    it("handles 100% discount", () => {
      expect(computeLineTotal(1, 100, 100, 10).total).toBe(0)
    })
  })

  describe("computeInvoiceTotals", () => {
    it("sums multiple items", () => {
      const totals = computeInvoiceTotals([
        { quantity: "2", unitPrice: "100", discountPercent: "0", taxPercent: "0" },
        { quantity: "1", unitPrice: "50", discountPercent: "10", taxPercent: "0" },
      ])
      // item1: 200, item2: 50 - 5 =45 => subtotal 250, discount 5, tax 0, grand 245
      expect(totals).toEqual({
        subtotal: "250.00",
        discountTotal: "5.00",
        taxTotal: "0.00",
        grandTotal: "245.00",
      })
    })

    it("handles empty items", () => {
      expect(computeInvoiceTotals([])).toEqual({
        subtotal: "0.00",
        discountTotal: "0.00",
        taxTotal: "0.00",
        grandTotal: "0.00",
      })
    })

    it("handles tax only", () => {
      const totals = computeInvoiceTotals([
        { quantity: "1", unitPrice: "100", discountPercent: "0", taxPercent: "19" },
      ])
      expect(totals.taxTotal).toBe("19.00")
      expect(totals.grandTotal).toBe("119.00")
    })
  })

  describe("overdue derivation", () => {
    function derive(status: string, dueDate: string | null, paid: string, total: string) {
      const today = "2024-02-01"
      let derived = status
      if (derived !== "paid" && derived !== "cancelled" && derived !== "draft" && dueDate && dueDate < today) {
        if (parseFloat(paid) < parseFloat(total)) derived = "overdue"
      }
      return derived
    }

    it("marks sent overdue when past due and not paid", () => {
      expect(derive("sent", "2024-01-01", "0", "100")).toBe("overdue")
    })

    it("does not mark paid as overdue", () => {
      expect(derive("paid", "2024-01-01", "0", "100")).toBe("paid")
    })

    it("does not mark draft as overdue", () => {
      expect(derive("draft", "2024-01-01", "0", "100")).toBe("draft")
    })

    it("does not mark overdue when fully paid", () => {
      expect(derive("sent", "2024-01-01", "100", "100")).toBe("sent")
    })
  })

  describe("initial status from paidAmount", () => {
    function getInitialStatus(paid: number, grandTotal: number) {
      if (paid >= grandTotal) return "paid"
      if (paid > 0) return "partially_paid"
      return "draft"
    }

    it("draft when nothing paid", () => expect(getInitialStatus(0, 100)).toBe("draft"))
    it("partially_paid when partially", () => expect(getInitialStatus(50, 100)).toBe("partially_paid"))
    it("paid when fully paid", () => expect(getInitialStatus(100, 100)).toBe("paid"))
    it("paid when overpaid", () => expect(getInitialStatus(150, 100)).toBe("paid"))
  })
})
