export type Project = {
  id: string
  primaryOwnerId: string
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
  inProgressTasks: { id: string; title: string; assignee: string; assigneeImage: string | null }[]
  owners: { id: string; name: string; image: string | null }[]
  collaborators: { id: string; name: string; image: string | null }[]
}
