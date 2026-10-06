"use client"

import { useRefreshOnFocus } from "@/hooks/use-refresh-on-focus"

/**
 * Asks the router to refresh when the window regains focus.
 *
 * It lives here, in `app/app/layout.tsx`, and nowhere else: `router.refresh()`
 * re-runs the whole route tree, so one listener in the root layout feeds every
 * provider beneath it, and no provider can register a second one. Registering
 * it per store instead would mean deciding, for each route, which of its
 * providers owns the listener — a rule that has to be written down, and that
 * silently doubles the request count when two providers both follow it.
 */
export function FocusRefresh() {
  useRefreshOnFocus()
  return null
}
