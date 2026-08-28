export interface ProjectMember {
  userId: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
}

export type ExpenseWithCategory = {
  id: string
  projectId: string
  categoryId: string
  description: string
  amount: string
  expenseDate: string
  createdAt: Date
  updatedAt: Date
  categoryName: string | null
  categorySlug: string | null
}

/** App-level metadata carried by calendar events. */
export interface CalendarEventMeta {
  kind?: "task" | "routine"
  taskId?: string
  routineId?: string
  projectId?: string
  projectName?: string
  projectOwnerName?: string | null
  status?: string
  priority?: string | null
  assigneeName?: string | null
  dueDateIso?: string | null
  description?: string | null
  cost?: string | null
  commentCount?: number
  recurrence?: string
  interval?: number
  daysOfWeek?: string[]
  time?: string | null
  startDate?: string | null
  endDate?: string | null
}

export type Project = {
  id: string
  primaryOwnerId: string
  name: string
  description: string | null
  status: "active" | "completed" | "cancelled" | "archived"
  color: string
  categorySlug: string | null
  startDate: string
  endDate: string
  location: string | null
  budget: number
  expenses: number
  tasksTotal: number
  tasksCompleted: number
  inProgressTasks: {
    id: string
    title: string
    assignee: string
    assigneeImage: string | null
  }[]
  owners: { id: string; name: string; image: string | null }[]
  collaborators: { id: string; name: string; image: string | null }[]
}

/** Minimal task row needed to build calendar task events. */
export interface CalendarTaskData {
  id: string
  name: string
  projectId: string
  projectName: string
  projectColor: string
  projectOwnerName: string | null
  description: string | null
  cost: string | null
  status: string
  priority: string | null
  routineId: string | null
  dueDate: Date | null
  assigneeName: string | null
  commentCount: number
}

/** Minimal routine row needed to expand recurring events on the client. */
export interface CalendarRoutineData {
  id: string
  name: string
  description: string | null
  cost: string | null
  projectId: string
  projectName: string
  projectColor: string
  projectOwnerName: string | null
  assigneeName: string | null
  recurrence: "daily" | "weekly"
  interval: number
  daysOfWeek: string[] | null
  time: string | null
  startDate: string | null
  endDate: string | null
}
