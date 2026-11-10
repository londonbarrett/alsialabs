import { z } from "zod"

export const MonthlyRevenueSchema = z.object({
  month: z.string(),
  productRevenue: z.number(),
  serviceRevenue: z.number(),
  productQuantity: z.number(),
  serviceQuantity: z.number(),
})

export const TopClientByRevenueSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  totalRevenue: z.string(),
  invoiceCount: z.number(),
})

export type MonthlyRevenueDTO = z.infer<typeof MonthlyRevenueSchema>
export type TopClientByRevenueDTO = z.infer<typeof TopClientByRevenueSchema>
