import { ProjectDetailView } from "@/components/projects/project-detail-view"
import { getExpensesByProjectId } from "@/lib/actions/expenses"
import { getProjectCategoriesList } from "@/lib/actions/project-categories"
import { getProjectTasks } from "@/lib/actions/project-tasks"
import {
  getProjectCollaborators,
  getProjectOwners,
} from "@/lib/actions/project-users"
import { getProjectById } from "@/lib/actions/projects"
import { getAssignableUsers } from "@/lib/actions/users"
import { db } from "@/lib/drizzle/client"
import { expenseCategoriesTable } from "@/lib/drizzle/schema"
import {
  auth,
  getUserPermissions,
  hasPermission,
  isSuperUser,
} from "@/lib/auth"
import { forbidden, notFound } from "next/navigation"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (
    !session?.user?.id ||
    !(await hasPermission(session.user.id, "projects", "view"))
  ) {
    forbidden()
  }

  let project
  try {
    project = await getProjectById(id)
  } catch {
    notFound()
  }

  const [
    tasks,
    permissions,
    categories,
    owners,
    collaborators,
    allUsersResult,
    expenses,
    expenseCategories,
  ] = await Promise.all([
    getProjectTasks(id),
    getUserPermissions(session.user.id),
    getProjectCategoriesList(),
    getProjectOwners(id),
    getProjectCollaborators(id),
    getAssignableUsers().catch(() => ({
      success: false as const,
      users: [],
    })),
    getExpensesByProjectId(id).catch(() => []),
    db.select().from(expenseCategoriesTable).orderBy(expenseCategoriesTable.slug),
  ])

  const allUsers = allUsersResult.success ? allUsersResult.users : []

  return (
    <ProjectDetailView
      project={project}
      tasks={tasks}
      permissions={permissions}
      categories={categories}
      owners={owners}
      collaborators={collaborators}
      allUsers={allUsers}
      expenses={expenses}
      expenseCategories={expenseCategories}
      currentUserId={session.user.id}
      isCurrentUserAdmin={isSuperUser(session)}
    />
  )
}
