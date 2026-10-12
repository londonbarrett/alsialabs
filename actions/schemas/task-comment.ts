import { z } from "zod"

export const TaskCommentSchema = z.object({
  content: z
    .string()
    .min(1, { message: "COMMENT_REQUIRED" })
    .transform((v) => v.trim()),
})

export const CreateTaskCommentSchema = TaskCommentSchema.extend({
  taskId: z.uuid(),
})

export const UpdateTaskCommentSchema = TaskCommentSchema.extend({
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export const DeleteTaskCommentSchema = z.object({
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export type CreateTaskCommentDTO = z.infer<typeof CreateTaskCommentSchema>
export type UpdateTaskCommentDTO = z.infer<typeof UpdateTaskCommentSchema>

// ---------- Response schemas ----------

export const TaskCommentWithAuthorSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  authorId: z.string(),
  authorName: z.string().nullable(),
  authorImage: z.string().nullable(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const TaskCommentResultSchema = z.object({
  comment: TaskCommentWithAuthorSchema,
})

export const DeleteTaskCommentResultSchema = z.object({
  commentId: z.string(),
})

export type TaskCommentWithAuthorDTO = z.infer<
  typeof TaskCommentWithAuthorSchema
>
export type DeleteTaskCommentResultDTO = z.infer<
  typeof DeleteTaskCommentResultSchema
>