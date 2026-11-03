export function filterAvailableTableNames(
  stored: string[] | null,
  available: string[]
): string[] | null {
  if (stored === null) return null
  const allowed = new Set(available)
  const filtered = stored.filter((name) => allowed.has(name))
  return filtered.length > 0 ? filtered : null
}
