"use client"

import type { ServerSeededStore } from "@/lib/optimistic-store"
import { useEffect, useRef } from "react"

/**
 * Calls `store.reseedFromServer` when the server sends a provider new seed data.
 *
 * A provider seeds its store from props in a lazy initializer, and client state
 * survives `router.refresh()`, so a refresh on its own updates nothing: the page
 * re-renders with new props that nobody reads. Each store owns the merge, since
 * it alone knows which slice the server sent and which parts were loaded
 * client-side and must survive.
 *
 * `serverData` is compared by identity, which is the right signal here: these
 * props are built by the server component, so a new reference means the server
 * re-ran (a refresh, a navigation) while client-only re-renders keep passing the
 * same reference. That avoids deep-comparing every list on every focus.
 *
 * The store comes from a `useState` initializer and the data comes from props,
 * so both are stable — no callback to hold in a ref, and no dependency churn.
 */
export function useServerReseed<S, A, Seed>(
  store: ServerSeededStore<S, A, Seed>,
  serverData: Seed
) {
  const seen = useRef(serverData)

  useEffect(() => {
    // Skip the seed itself: the store already holds this data.
    if (seen.current === serverData) return
    seen.current = serverData
    store.getState().reseedFromServer(serverData)
  }, [serverData, store])
}
