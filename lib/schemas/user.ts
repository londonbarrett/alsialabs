import { z } from "zod"

export const createUserSchema = z.object({
  email: z
    .email({ message: "Invalid email" })
    .transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, { message: "Role is required" }),
})

export const updateUserSchema = z.object({
  userId: z.string().min(1, { message: "Invalid user ID" }),
  email: z
    .email({ message: "Invalid email" })
    .transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, { message: "Role is required" }),
})

export const deleteUserSchema = z.object({
  userId: z.string().min(1, { message: "Invalid user ID" }),
})

export const searchUsersSchema = z.object({
  query: z.string(),
  excludedIds: z.array(z.string()).optional(),
})

export const getUserByIdSchema = z.object({
  userId: z.string().min(1, { message: "Invalid user ID" }),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
