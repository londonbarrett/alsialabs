import { z } from "zod"

export const PaymentSchema = z.object({
  amount: z.string().min(1, { message: "Amount is required" }),
  paymentDate: z.string().min(1, { message: "Payment date is required" }),
  method: z.string().optional().default(""),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
})

export type PaymentDTO = z.infer<typeof PaymentSchema>
