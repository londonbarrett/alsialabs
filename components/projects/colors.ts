export const PROJECT_COLORS = [
  "#eab308",
  "#f97316",
  "#8b5cf6",
  "#3b82f6",
  "#22c55e",
  "#6b7280",
] as const

export type ProjectColor = (typeof PROJECT_COLORS)[number]

export const PROJECT_COLOR_NAME_KEYS = [
  "yellow",
  "orange",
  "violet",
  "blue",
  "green",
  "gray",
] as const
