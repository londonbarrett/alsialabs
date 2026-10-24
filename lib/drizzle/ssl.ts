export function resolveSslOption(
  value: string | undefined
): "require" | "prefer" | false {
  if (value === "disable") return false
  if (value === "prefer") return "prefer"
  return "require"
}
