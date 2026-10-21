import { z } from "zod"

export const LineItemSchema = z.object({
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

export const InvoiceSchema = z.object({
  type: z.enum(["product", "service"]),
  clientId: z.string().min(1, { message: "Client is required" }),
  issueDate: z.string().min(1, { message: "Issue date is required" }),
  dueDate: z.string().optional().default(""),
  paidAmount: z.string().optional().default("0"),
  notes: z.string().optional().default(""),
  items: z
    .array(LineItemSchema)
    .min(1, { message: "At least one line item is required" }),
})

export const CreateInvoiceSchema = InvoiceSchema

export const UpdateInvoiceSchema = InvoiceSchema.extend({
  invoiceId: z.uuid(),
})

export type InvoiceDTO = z.infer<typeof InvoiceSchema>
export type CreateInvoiceDTO = z.infer<typeof CreateInvoiceSchema>
export type UpdateInvoiceDTO = z.infer<typeof UpdateInvoiceSchema>
export type LineItemDTO = z.infer<typeof LineItemSchema>

// ---------- Response schemas ----------

export const InvoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "cancelled",
])

export const InvoiceTypeSchema = z.enum(["product", "service"])

export const InvoiceItemSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  discountPercent: z.string(),
  taxPercent: z.string(),
  total: z.string(),
  productId: z.string().nullable(),
})

export const InvoicePaymentSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.string(),
  paymentDate: z.string(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  userId: z.string().nullable(),
  createdAt: z.date(),
})

export const InvoicePaymentWithNumberSchema =
  InvoicePaymentSchema.extend({
    invoiceNumber: z.string(),
  })

export const InvoiceRecordSchema = z.object({
  id: z.string(),
  store_id: z.string().nullable(),
  type: InvoiceTypeSchema,
  invoiceNumber: z.string(),
  clientId: z.string(),
  userId: z.string().nullable(),
  status: InvoiceStatusSchema,
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  paidAmount: z.string(),
  notes: z.string().nullable(),
  subtotal: z.string(),
  discountTotal: z.string(),
  taxTotal: z.string(),
  grandTotal: z.string(),
  projectId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const MyInvoiceSchema = InvoiceRecordSchema.extend({
  outstandingBalance: z.string(),
  projectName: z.string().nullable(),
})

export const MyInvoicesResultSchema = z.object({
  clientId: z.string().nullable(),
  invoices: z.array(MyInvoiceSchema),
})

export const MyInvoiceDetailsSchema = z.object({
  invoice: MyInvoiceSchema,
  items: z.array(InvoiceItemSchema),
  payments: z.array(InvoicePaymentSchema),
})

export const InvoiceWithClientNameSchema = InvoiceRecordSchema.extend({
  clientName: z.string().nullable(),
})

export const InvoiceProductOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type InvoiceStatusDTO = z.infer<typeof InvoiceStatusSchema>
export type InvoiceTypeDTO = z.infer<typeof InvoiceTypeSchema>
export type InvoiceItemDTO = z.infer<typeof InvoiceItemSchema>
export type InvoicePaymentDTO = z.infer<typeof InvoicePaymentSchema>
export type InvoicePaymentWithNumberDTO = z.infer<
  typeof InvoicePaymentWithNumberSchema
>
export type InvoiceRecordDTO = z.infer<typeof InvoiceRecordSchema>
export type MyInvoiceDTO = z.infer<typeof MyInvoiceSchema>
export type MyInvoicesResultDTO = z.infer<typeof MyInvoicesResultSchema>
export type MyInvoiceDetailsDTO = z.infer<typeof MyInvoiceDetailsSchema>
export type InvoiceWithClientNameDTO = z.infer<
  typeof InvoiceWithClientNameSchema
>
export type InvoiceProductOptionDTO = z.infer<
  typeof InvoiceProductOptionSchema
>
