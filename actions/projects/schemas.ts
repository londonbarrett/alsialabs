import { type ProjectStatus as ProjectStatusType } from "@/lib/drizzle/schema"
import { z } from "zod"
import { PROJECT_COLORS } from "@/components/projects/colors"
import { CategoryOptionSchema } from "@/actions/legacy/schemas/category"

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

export const ProjectSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .transform((v) => v.trim()),
  categoryId: z.string().min(1, { message: "Category is required" }),
  status: z
    .enum(["active", "completed", "cancelled", "archived"])
    .optional()
    .default("active"),
  description: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  startDate: z.string().min(1, { message: "Start date is required" }),
  endDate: z.string().optional().default(""),
  location: z
    .string()
    .min(1, { message: "Location is required" })
    .transform((v) => v.trim()),
  budget: z.string().optional().default(""),
  color: z.enum(PROJECT_COLORS, {
    message: "Color is required",
  }),
})

export const CreateProjectSchema = ProjectSchema

export const UpdateProjectSchema = ProjectSchema.extend({
  projectId: z.uuid(),
})

export const ProjectAccessResultSchema = z.object({
  hasAccess: z.boolean(),
  role: z.enum(["owner", "admin", "collaborator"]).nullable(),
})

export type ProjectDTO = z.infer<typeof ProjectSchema>
export type CreateProjectDTO = z.infer<typeof CreateProjectSchema>
export type UpdateProjectDTO = z.infer<typeof UpdateProjectSchema>
export type ProjectAccessResultDTO = z.infer<
  typeof ProjectAccessResultSchema
>
export type ProjectStatusDTO = ProjectStatusType

// ---------- Response schemas ----------

export const ProjectStatusSchema = z.enum([
  "active",
  "completed",
  "cancelled",
  "archived",
] as const)

export const ProjectRecordSchema = z.object({
  id: z.string(),
  primaryOwnerId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  startDate: z.string(),
  endDate: z.string().nullable(),
  location: z.string().nullable(),
  budget: z.string().nullable(),
  color: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const ProjectDetailSchema = ProjectRecordSchema.extend({
  categorySlug: z.string().nullable(),
  categoryName: z.string().nullable(),
})

export const ProjectOptionSchema = ProjectDetailSchema.extend({
  ownerName: z.string().nullable(),
})

export const ProjectInProgressTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  assignee: z.string(),
  assigneeImage: z.string().nullable(),
})

export const ProjectPersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
})

export const ProjectSummarySchema = z.object({
  id: z.string(),
  primaryOwnerId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  color: z.string(),
  categorySlug: z.string().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  location: z.string().nullable(),
  budget: z.number(),
  expenses: z.number(),
  tasksTotal: z.number(),
  tasksCompleted: z.number(),
  inProgressTasks: z.array(ProjectInProgressTaskSchema),
  members: z.array(
    ProjectPersonSchema.extend({
      role: z.enum(["owner", "admin", "collaborator"]),
    })
  ),
})

export const ProjectSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    role: z.string().nullable(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  }),
  expires: z.union([z.string(), z.date()]),
})

export const ProjectContextSchema = z.object({
  project: ProjectDetailSchema,
  members: z.array(ProjectMemberRowSchema),
  permissions: z.array(z.string()),
  session: ProjectSessionSchema,
  currentRole: z.enum(["owner", "admin", "collaborator"]),
  currentUserId: z.string(),
  categories: z.array(CategoryOptionSchema),
})

export type ProjectRecordDTO = z.infer<typeof ProjectRecordSchema>
export type ProjectDetailDTO = z.infer<typeof ProjectDetailSchema>
export type ProjectOptionDTO = z.infer<typeof ProjectOptionSchema>
export type ProjectInProgressTaskDTO = z.infer<
  typeof ProjectInProgressTaskSchema
>
export type ProjectPersonDTO = z.infer<typeof ProjectPersonSchema>
export type ProjectSummaryDTO = z.infer<typeof ProjectSummarySchema>
export type ProjectContextDTO = z.infer<typeof ProjectContextSchema>
