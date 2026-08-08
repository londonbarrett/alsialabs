import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTaskOverdue(
  status: string,
  dueDate: Date | string | null | undefined
): boolean {
  if (!dueDate || status === "done") return false
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}
