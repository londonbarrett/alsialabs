import { z } from "zod"

export const clientSchema = z.object({
  name: z
    .string()
    .min(1, { message: "NAME_REQUIRED" })
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, { message: "PHONE_REQUIRED" })
    .transform((v) => v.trim()),
  location: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  comments: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  email: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "EMAIL_INVALID",
    }),
})

export const createClientSchema = clientSchema

export const updateClientSchema = clientSchema.extend({
  id: z.uuid(),
})

export const phoneSchema = z
  .string()
  .min(1, { message: "PHONE_REQUIRED" })
  .transform((v) => v.trim())

export const inviteSchema = z.object({
  clientId: z.uuid({ message: "CLIENT_ID_INVALID" }),
  email: z
    .string()
    .email({ message: "EMAIL_INVALID" })
    .transform((v) => v.trim().toLowerCase())
    .optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
