export interface Project {
  id: string
  name: string
  description: string | null
  status: "active" | "completed" | "cancelled" | "archived"
  category: string
  startDate: string
  endDate: string
  location: string | null
  budget: number
  expenses: number
  tasksTotal: number
  tasksCompleted: number
  inProgressTasks: { id: string; title: string; assignee: string }[]
  collaborators: { id: string; name: string }[]
}

export const statusConfig: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  active: {
    label: "Active",
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400",
    dot: "bg-green-500",
  },
  completed: {
    label: "Completed",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  archived: {
    label: "Archived",
    className:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    dot: "bg-gray-500",
  },
}
