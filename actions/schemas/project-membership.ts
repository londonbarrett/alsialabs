import { z } from "zod"

export const ProjectMemberRoleSchema = z.enum([
  "owner",
  "admin",
  "collaborator",
])

export const ProjectMembershipRoleSchema = z.enum([
  "admin",
  "collaborator",
])

export const ProjectMemberRowSchema = z.object({
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  userImage: z.string().nullable(),
  role: ProjectMemberRoleSchema,
  isPrimaryOwner: z.boolean(),
})

export const ProjectMembershipSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  role: ProjectMembershipRoleSchema,
})

export const MemberInputSchema = z.object({
  projectId: z.uuid(),
  userId: z.string().min(1),
})

export const SetMemberRoleSchema = MemberInputSchema.extend({
  role: ProjectMembershipRoleSchema,
})

export const TransferPrimaryOwnerSchema = z.object({
  projectId: z.uuid(),
  newOwnerId: z.string().min(1),
})

export const ProjectPrimaryOwnerSchema = z.object({
  primaryOwnerId: z.string(),
})

export type ProjectMemberRoleDTO = z.infer<
  typeof ProjectMemberRoleSchema
>
export type ProjectMemberRowDTO = z.infer<typeof ProjectMemberRowSchema>
export type ProjectMembershipDTO = z.infer<
  typeof ProjectMembershipSchema
>
export type ProjectPrimaryOwnerDTO = z.infer<
  typeof ProjectPrimaryOwnerSchema
>
