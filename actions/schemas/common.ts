import { z } from "zod"

/** Shared input for actions addressed by a single record id. */
export const IdSchema = z.object({ id: z.uuid() })

/** The envelope mutations return when they have no payload but succeeded. */
export const SuccessSchema = z.object({ success: z.literal(true) })

/** Standard response for any "does this value already exist?" check. */
export const ExistsSchema = z.object({ exists: z.boolean() })

export type IdDTO = z.infer<typeof IdSchema>
export type SuccessDTO = z.infer<typeof SuccessSchema>
export type ExistsDTO = z.infer<typeof ExistsSchema>
