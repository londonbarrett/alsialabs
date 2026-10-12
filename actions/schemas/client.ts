import { z } from "zod"

export const ClientSchema = z.object({
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

export const CreateClientSchema = ClientSchema

export const UpdateClientSchema = ClientSchema.extend({
  id: z.uuid(),
})

export const PhoneSchema = z
  .string()
  .min(1, { message: "PHONE_REQUIRED" })
  .transform((v) => v.trim())

export const InviteSchema = z.object({
  clientId: z.uuid({ message: "CLIENT_ID_INVALID" }),
  email: z
    .string()
    .email({ message: "EMAIL_INVALID" })
    .transform((v) => v.trim().toLowerCase())
    .optional(),
})

export type ClientDTO = z.infer<typeof ClientSchema>
export type CreateClientDTO = z.infer<typeof CreateClientSchema>
export type UpdateClientDTO = z.infer<typeof UpdateClientSchema>

// ---------- Response schemas ----------

export const ClientRecordSchema = z.object({
  id: z.string(),
  store_id: z.string().nullable(),
  name: z.string(),
  phone: z.string(),
  location: z.string().nullable(),
  comments: z.string().nullable(),
  email: z.string().nullable(),
  userId: z.string().nullable(),
})

export const ClientOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
})

export type ClientRecordDTO = z.infer<typeof ClientRecordSchema>
export type ClientOptionDTO = z.infer<typeof ClientOptionSchema>
