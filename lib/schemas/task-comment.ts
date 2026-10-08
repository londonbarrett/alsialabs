import { z } from "zod"

export const taskCommentSchema = z.object({
  content: z
    .string()
    .min(1, { message: "COMMENT_REQUIRED" })
    .transform((v) => v.trim()),
})

export const createTaskCommentSchema = taskCommentSchema.extend({
  taskId: z.uuid(),
})

export const updateTaskCommentSchema = taskCommentSchema.extend({
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export const deleteTaskCommentSchema = z.object({
  taskId: z.uuid(),
  commentId: z.uuid(),
})

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>
export type UpdateTaskCommentInput = z.infer<typeof updateTaskCommentSchema>