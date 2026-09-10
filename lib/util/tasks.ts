export function isTaskOverdue(
  status: string,
  dueDate: Date | string | null | undefined
): boolean {
  if (!dueDate || status === "done" || status === "cancelled") return false
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}
