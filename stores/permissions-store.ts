import { create } from "zustand"

interface PermissionsState {
  permissions: string[]
  setPermissions: (permissions: string[]) => void
  resetPermissions: () => void
}

/**
 * Globally available permission codes for the current user.
 * Seeded once per request by <PermissionsSync> in the dashboard layout.
 */
export const usePermissionsStore = create<PermissionsState>()((set) => ({
  permissions: [],
  setPermissions: (permissions) => set({ permissions }),
  resetPermissions: () => set({ permissions: [] }),
}))

export function usePermissions(): string[] {
  return usePermissionsStore((s) => s.permissions)
}

export function useHasPermission(code: string): boolean {
  return usePermissionsStore((s) => s.permissions.includes(code))
}