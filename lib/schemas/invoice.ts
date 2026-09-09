import { z } from "zod"

export const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .transform((v) => v.trim()),
  quantity: z.string().min(1, { message: "Quantity is required" }),
  unitPrice: z.string().min(1, { message: "Unit price is required" }),
  discountPercent: z.string().optional().default("0"),
  taxPercent: z.string().optional().default("0"),
  productId: z.string().nullable().optional(),
})

export const invoiceSchema = z.object({
  type: z.enum(["product", "service"]),
  clientId: z.string().min(1, { message: "Client is required" }),
  issueDate: z.string().min(1, { message: "Issue date is required" }),
  dueDate: z.string().optional().default(""),
  paidAmount: z.string().optional().default("0"),
  notes: z.string().optional().default(""),
  items: z
    .array(lineItemSchema)
    .min(1, { message: "At least one line item is required" }),
})

export const createInvoiceSchema = invoiceSchema

export const updateInvoiceSchema = invoiceSchema.extend({
  invoiceId: z.uuid(),
})

export type InvoiceFormData = z.infer<typeof invoiceSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type LineItemInput = z.infer<typeof lineItemSchema>
