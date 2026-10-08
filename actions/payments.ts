"use server"

import { db } from "@/lib/drizzle/client"
import { invoicePaymentsTable, invoicesTable } from "@/lib/drizzle/schema"
import { returnActionError, sessionAction } from "@/lib/safe-action"
import { paymentSchema } from "@/lib/schemas/payment"
import { and, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"

export const recordPayment = sessionAction
  .metadata({
    permission: { module: "sales", action: "create" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(paymentSchema.extend({ invoiceId: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const { invoiceId, ...data } = parsedInput
    const amount = parseFloat(data.amount) || 0

    if (amount <= 0) {
      returnActionError("VALIDATION_FAILED")
    }

    const [invoice] = await db
      .select({
        grandTotal: invoicesTable.grandTotal,
        paidAmount: invoicesTable.paidAmount,
        status: invoicesTable.status,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .limit(1)

    if (!invoice) {
      returnActionError("NOT_FOUND")
    }

    if (invoice.status === "cancelled") {
      returnActionError("VALIDATION_FAILED")
    }

    const currentPaid = parseFloat(invoice.paidAmount) || 0
    const grandTotal = parseFloat(invoice.grandTotal) || 0
    const remaining = grandTotal - currentPaid

    if (amount > remaining) {
      returnActionError("VALIDATION_FAILED")
    }

    const newPaid = currentPaid + amount
    const newStatus = newPaid >= grandTotal ? "paid" : "partially_paid"

    await db.transaction(async (tx) => {
      await tx
        .update(invoicesTable)
        .set({
          paidAmount: newPaid.toFixed(2),
          status: newStatus,
        })
        .where(eq(invoicesTable.id, invoiceId))

      await tx.insert(invoicePaymentsTable).values({
        invoiceId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        method: data.method || null,
        reference: data.reference || null,
        notes: data.notes || null,
        userId: ctx.session.user.id,
      })
    })

    return { success: true as const }
  })

// Transaction client injected by `db.transaction` – inferred from the `db` instance
// to keep the helper correctly typed without hardcoding `PgTransaction` generics.
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function syncInvoicePaymentState(
  tx: Transaction,
  invoiceId: string,
) {
  const [invoice] = await tx
    .select({
      grandTotal: invoicesTable.grandTotal,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .where(eq(invoicesTable.id, invoiceId))
    .limit(1)

  if (!invoice) return

  const [sumResult] = await tx
    .select({
      total: sql<string>`coalesce(sum(${invoicePaymentsTable.amount})::numeric, 0)::text`,
    })
    .from(invoicePaymentsTable)
    .where(eq(invoicePaymentsTable.invoiceId, invoiceId))

  const paid = parseFloat(sumResult.total) || 0
  const grandTotal = parseFloat(invoice.grandTotal) || 0

  let status:
    | "draft"
    | "sent"
    | "paid"
    | "partially_paid"
    | "overdue"
    | "cancelled"
  if (invoice.status === "cancelled") {
    status = "cancelled"
  } else if (paid >= grandTotal) {
    status = "paid"
  } else if (paid > 0) {
    status = "partially_paid"
  } else {
    status = "draft"
  }

  await tx
    .update(invoicesTable)
    .set({ paidAmount: paid.toFixed(2), status })
    .where(eq(invoicesTable.id, invoiceId))
}

export const updatePayment = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(paymentSchema.extend({ paymentId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { paymentId, ...data } = parsedInput
    const newAmount = parseFloat(data.amount) || 0

    if (newAmount <= 0) {
      returnActionError("VALIDATION_FAILED")
    }

    const [payment] = await db
      .select({ invoiceId: invoicePaymentsTable.invoiceId })
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.id, paymentId))
      .limit(1)

    if (!payment) {
      returnActionError("NOT_FOUND")
    }

    const [invoice] = await db
      .select({ grandTotal: invoicesTable.grandTotal })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, payment.invoiceId))
      .limit(1)

    if (!invoice) {
      returnActionError("NOT_FOUND")
    }

    const grandTotal = parseFloat(invoice.grandTotal) || 0

    let ok = true

    await db.transaction(async (tx) => {
      const [others] = await tx
        .select({
          total: sql<string>`coalesce(sum(${invoicePaymentsTable.amount})::numeric, 0)::text`,
        })
        .from(invoicePaymentsTable)
        .where(
          and(
            eq(invoicePaymentsTable.invoiceId, payment.invoiceId),
            ne(invoicePaymentsTable.id, paymentId)
          )
        )

      const othersTotal = parseFloat(others.total) || 0
      if (othersTotal + newAmount > grandTotal) {
        ok = false
        return
      }

      await tx
        .update(invoicePaymentsTable)
        .set({
          amount: data.amount,
          paymentDate: data.paymentDate,
          method: data.method || null,
          reference: data.reference || null,
          notes: data.notes || null,
        })
        .where(eq(invoicePaymentsTable.id, paymentId))

      await syncInvoicePaymentState(tx, payment.invoiceId)
    })

    if (!ok) returnActionError("VALIDATION_FAILED")

    return { success: true as const }
  })

export const deletePayment = sessionAction
  .metadata({
    permission: { module: "sales", action: "delete" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ paymentId: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { paymentId } = parsedInput
    const [payment] = await db
      .select({ invoiceId: invoicePaymentsTable.invoiceId })
      .from(invoicePaymentsTable)
      .where(eq(invoicePaymentsTable.id, paymentId))
      .limit(1)

    if (!payment) {
      returnActionError("NOT_FOUND")
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(invoicePaymentsTable)
        .where(eq(invoicePaymentsTable.id, paymentId))
      await syncInvoicePaymentState(tx, payment.invoiceId)
    })

    return { success: true as const }
  })
