"use client"

import { usePermissionsStore } from "@/stores/permissions-store"

function samePermissions(a: string[], b: string[]): boolean {
  return (
    a.length === b.length &&
    a.every((code, i) => code === b[i])
  )
}

/**
 * Syncs server-computed data into client-side stores.
 * Uses a functional setState that returns the current state reference when
 * nothing changed, so hydration is idempotent and never triggers notify loops.
 */
export function StoreSync({ permissions }: { permissions: string[] }) {
  usePermissionsStore.setState((state) =>
    samePermissions(state.permissions, permissions)
      ? state
      : { permissions }
  )
  return null
}