import { z } from "zod"

export const StoreOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type StoreOptionDTO = z.infer<typeof StoreOptionSchema>
