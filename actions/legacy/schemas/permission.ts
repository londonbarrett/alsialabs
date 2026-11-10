import { z } from "zod"

export const PermissionMatrixItemSchema = z.object({
  id: z.string(),
  module: z.string(),
  action: z.string(),
  roleIds: z.array(z.string()),
})

export type PermissionMatrixItemDTO = z.infer<typeof PermissionMatrixItemSchema>

export const ManageModuleSchema = z.object({
  action: z.enum(["create", "delete"]),
  name: z
    .string()
    .min(1)
    .transform((v) => v.trim().toLowerCase()),
  actions: z.array(z.string().min(1)).optional(),
})

export const TogglePermissionSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
  enabled: z.boolean(),
})

export type ManageModuleDTO = z.infer<typeof ManageModuleSchema>
export type TogglePermissionDTO = z.infer<typeof TogglePermissionSchema>
