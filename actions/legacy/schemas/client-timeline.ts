import { z } from "zod"
import type { ClientReminder } from "@/lib/drizzle/schema"
import type { ClientActivityRecordDTO } from "./activity"

export const ClientTimelinePageInputSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(50).default(5),
})

export type ClientTimelineEntryDTO =
  | ({ kind: "activity" } & ClientActivityRecordDTO)
  | ({ kind: "reminder" } & ClientReminder)

export type ClientTimelinePageDTO = {
  entries: ClientTimelineEntryDTO[]
  hasMore: boolean
}

export type ClientTimelinePageInputDTO = z.infer<
  typeof ClientTimelinePageInputSchema
>
