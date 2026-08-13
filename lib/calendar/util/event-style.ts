export function eventTint(color: string | undefined) {
  if (!color) return undefined
  return {
    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
    borderColor: `color-mix(in oklab, ${color} 55%, transparent)`,
  }
}

export function eventDot(color: string | undefined) {
  return { backgroundColor: color ?? undefined }
}
