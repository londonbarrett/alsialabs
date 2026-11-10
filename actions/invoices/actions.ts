"use server"

import { getEffectiveStoreId } from "@/actions/legacy/not-safe/stores"
import { SuccessSchema } from "@/actions/legacy/schemas/common"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/actions/safe-action"
import { canViewProject } from "@/lib/util/project-roles"
import { z } from "zod"
import queries from "./queries"
import {
  BindInvoiceResultSchema,
  BindInvoiceToProjectSchema,
  CreateInvoiceSchema,
  InvoiceItemSchema,
  InvoicePaymentSchema,
  InvoicePaymentWithNumberSchema,
  InvoiceProductOptionSchema,
  InvoiceRecordSchema,
  InvoiceWithClientNameSchema,
  MyInvoiceDetailsSchema,
  MyInvoicesResultSchema,
  ProjectInvoiceSchema,
  UpdateInvoiceSchema,
} from "./schemas"

// ---------- Client / session reads ----------

export const getClientInvoices = sessionAction
  .inputSchema(z.object({ clientId: z.uuid() }))
  .metadata({
    permission: { module: "client-activity", action: "view" },
  })
  .outputSchema(z.array(InvoiceRecordSchema))
  .action(async ({ parsedInput, ctx }) => {
    const { clientId } = parsedInput
    const session = ctx.session

    if (session.user.role === "user") {
      const ownClient = await queries.getOwnClientRow(
        session.user.id,
        clientId
      )

      if (!ownClient) returnActionError("FORBIDDEN")
    }

    return queries.getClientInvoicesByClientId(clientId)
  })

export const getClientPayments = sessionAction
  .inputSchema(z.object({ clientId: z.uuid() }))
  .metadata({
    permission: { module: "client-activity", action: "view" },
  })
  .outputSchema(z.array(InvoicePaymentWithNumberSchema))
  .action(async ({ parsedInput, ctx }) => {
    const { clientId } = parsedInput
    const session = ctx.session

    if (session.user.role === "user") {
      const ownClient = await queries.getOwnClientRow(
        session.user.id,
        clientId
      )

      if (!ownClient) returnActionError("FORBIDDEN")
    }

    return queries.getClientPaymentsByClientId(clientId)
  })

export const getMyInvoices = sessionAction
  .metadata({})
  .outputSchema(MyInvoicesResultSchema)
  .action(async ({ ctx }) => {
    const session = ctx.session
    const email = session.user.email ?? null

    return queries.getMyInvoices(session.user.id, email)
  })

export const getMyPayments = sessionAction
  .metadata({})
  .outputSchema(z.array(InvoicePaymentWithNumberSchema))
  .action(async ({ ctx }) => {
    const session = ctx.session
    const email = session.user.email ?? null

    return queries.getMyPayments(session.user.id, email)
  })

export const getMyInvoiceDetails = sessionAction
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .metadata({})
  .outputSchema(MyInvoiceDetailsSchema)
  .action(async ({ parsedInput, ctx }) => {
    const session = ctx.session
    const email = session.user.email ?? null

    const details = await queries.getMyInvoiceDetails(
      parsedInput.invoiceId,
      session.user.id,
      email
    )
    if (!details) returnActionError("FORBIDDEN")

    return details
  })

export const bindInvoiceToProject = sessionAction
  .inputSchema(BindInvoiceToProjectSchema)
  .metadata({ revalidate: ["/app/mis-facturas"] })
  .outputSchema(BindInvoiceResultSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { invoiceId, projectId } = parsedInput
    const session = ctx.session
    const email = session.user.email ?? null

    const uniqueIds = await queries.getSessionClientIds(
      session.user.id,
      email
    )
    if (uniqueIds.length === 0) returnActionError("FORBIDDEN")

    const invoice = await queries.getInvoiceClientId(invoiceId)
    if (!invoice) returnActionError("NOT_FOUND")
    if (!uniqueIds.includes(invoice.clientId))
      returnActionError("FORBIDDEN")

    if (projectId !== null) {
      const owned = await queries.getOwnedProjectRow(
        projectId,
        session.user.id
      )
      if (!owned) returnActionError("FORBIDDEN")
    }

    const updated = await queries.updateInvoiceProject(
      invoiceId,
      projectId
    )
    if (!updated) returnActionError("NOT_FOUND")

    return updated
  })

// ---------- Project invoices ----------

export const getProjectInvoices = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(z.array(ProjectInvoiceSchema))
  .action(async ({ parsedInput, ctx }) => {
    // Collaborators are invisible to the project surface, so they must not
    // read its invoices either.
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    return queries.getProjectInvoicesByProjectId(parsedInput.projectId)
  })

// ---------- Sales invoice actions (migrated from sales) ----------

export const getInvoices = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .outputSchema(z.array(InvoiceWithClientNameSchema))
  .action(async () => {
    const storeId = await getEffectiveStoreId()

    return queries.getSalesInvoices(storeId)
  })

export const getInvoiceProducts = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .outputSchema(z.array(InvoiceProductOptionSchema))
  .action(async () => {
    const storeId = await getEffectiveStoreId()

    return queries.getInvoiceProductOptions(storeId)
  })

export const getInvoiceItems = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(z.array(InvoiceItemSchema))
  .action(async ({ parsedInput }) => {
    return queries.getInvoiceItemsByInvoiceId(parsedInput.invoiceId)
  })

export const getInvoicePayments = sessionAction
  .metadata({ permission: { module: "sales", action: "view" } })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(z.array(InvoicePaymentSchema))
  .action(async ({ parsedInput }) => {
    return queries.getInvoicePaymentsByInvoiceId(parsedInput.invoiceId)
  })

export const createInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "create" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(CreateInvoiceSchema)
  .outputSchema(InvoiceRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const storeId = await getEffectiveStoreId()

    return queries.createInvoice(
      parsedInput,
      ctx.session.user.id,
      storeId
    )
  })

export const updateInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(UpdateInvoiceSchema)
  .outputSchema(InvoiceRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    const storeId = await getEffectiveStoreId()

    const updated = await queries.updateInvoice(
      parsedInput,
      ctx.session.user.id,
      storeId
    )
    if (!updated) returnActionError("NOT_FOUND")

    return updated
  })

export const cancelInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()

    await queries.updateInvoiceStatus(
      parsedInput.invoiceId,
      "cancelled",
      storeId
    )

    return { success: true }
  })

export const reopenInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()

    await queries.updateInvoiceStatus(
      parsedInput.invoiceId,
      "draft",
      storeId
    )

    return { success: true }
  })

export const markInvoiceAsSent = sessionAction
  .metadata({
    permission: { module: "sales", action: "edit" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()

    await queries.updateInvoiceStatus(
      parsedInput.invoiceId,
      "sent",
      storeId
    )

    return { success: true }
  })

export const deleteInvoice = sessionAction
  .metadata({
    permission: { module: "sales", action: "delete" },
    revalidate: ["/app/ventas"],
  })
  .inputSchema(z.object({ invoiceId: z.uuid() }))
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput }) => {
    const storeId = await getEffectiveStoreId()

    try {
      await queries.deleteInvoice(parsedInput.invoiceId, storeId)
    } catch {
      returnActionError("CANNOT_DELETE_INVOICE")
    }

    return { success: true }
  })
