"use server"

import { sessionAction } from "@/actions/safe-action"
import { z } from "zod"
import queries from "./queries"
import {
  CalendarAssignmentSchema,
  CalendarRangeSchema,
} from "./schemas"
import { resolveCalendarRange } from "./util"

export const getCalendarAssignments = sessionAction
  .inputSchema(CalendarRangeSchema)
  .metadata({})
  .outputSchema(z.array(CalendarAssignmentSchema))
  .action(async ({ parsedInput, ctx }) => {
    const range = resolveCalendarRange(parsedInput)

    return queries.getVisibleCalendarAssignments(
      ctx.session.user.id,
      range
    )
  })
