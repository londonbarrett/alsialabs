import { z } from "zod"
import { PROJECT_COLORS } from "@/components/projects/colors"

export const projectSchema = z.object({
  name: z.string().min(1, { message: "Name is required" })
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
  location: z.string().min(1, { message: "Location is required" })
    .transform((v) => v.trim()),
  budget: z.string().optional().default(""),
  color: z.enum(PROJECT_COLORS, {
    message: "Color is required",
  }),
})

export const createProjectSchema = projectSchema

export const updateProjectSchema = projectSchema.extend({
  projectId: z.uuid(),
})

export type ProjectFormData = z.infer<typeof projectSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
