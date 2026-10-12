import { z } from "zod"

export const ProjectMemberSchema = z.object({
  userId: z.string(),
  userName: z.string().nullable(),
  userEmail: z.string().nullable(),
  userImage: z.string().nullable(),
})

export const ProjectOwnerSchema = ProjectMemberSchema.extend({
  primaryOwnerId: z.string(),
})

export const ProjectMembershipSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
})

export const ProjectPrimaryOwnerSchema = z.object({
  primaryOwnerId: z.string(),
})

export const MemberInputSchema = z.object({
  projectId: z.uuid(),
  userId: z.string().min(1),
})

export type ProjectMemberDTO = z.infer<typeof ProjectMemberSchema>
export type ProjectOwnerDTO = z.infer<typeof ProjectOwnerSchema>
export type ProjectMembershipDTO = z.infer<typeof ProjectMembershipSchema>
export type ProjectPrimaryOwnerDTO = z.infer<
  typeof ProjectPrimaryOwnerSchema
>
