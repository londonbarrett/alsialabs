"use client"

import { createContext, use, useMemo } from "react"

type PermissionsContextValue = {
  permissions: string[]
  hasPermission: (code: string) => boolean
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

/**
 * Makes the server-computed permission codes for the current user available to
 * the client tree. Seeded once per request by the dashboard layout.
 */
export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[]
  children: React.ReactNode
}) {
  const value = useMemo(
    () => ({
      permissions,
      hasPermission: (code: string) => permissions.includes(code),
    }),
    [permissions]
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

function usePermissionsContext() {
  const context = use(PermissionsContext)
  if (!context) {
    throw new Error(
      "useHasPermission must be used within a PermissionsProvider."
    )
  }
  return context
}

export function usePermissions(): string[] {
  return usePermissionsContext().permissions
}

export function useHasPermission(code: string): boolean {
  return usePermissionsContext().hasPermission(code)
}