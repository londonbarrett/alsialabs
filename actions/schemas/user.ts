import { z } from "zod"

export const CreateUserSchema = z.object({
  email: z
    .email({ message: "Invalid email" })
    .transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, { message: "Role is required" }),
})

export const UpdateUserSchema = z.object({
  userId: z.string().min(1, { message: "Invalid user ID" }),
  email: z
    .email({ message: "Invalid email" })
    .transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, { message: "Role is required" }),
})

export const DeleteUserSchema = z.object({
  userId: z.string().min(1, { message: "Invalid user ID" }),
})

export const SearchUsersSchema = z.object({
  query: z.string(),
  excludedIds: z.array(z.string()).optional(),
})

export type CreateUserDTO = z.infer<typeof CreateUserSchema>
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>

// ---------- Response schemas ----------

export const UserOptionSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
})

export const UserWithRoleSchema = UserOptionSchema.extend({
  roleId: z.string(),
  roleName: z.string(),
})

export const UserIdResultSchema = z.object({ id: z.string() })

export type UserOptionDTO = z.infer<typeof UserOptionSchema>
export type UserWithRoleDTO = z.infer<typeof UserWithRoleSchema>
export type UserIdResultDTO = z.infer<typeof UserIdResultSchema>
