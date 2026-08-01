import { ProjectExpenses } from "@/components/projects/expenses/project-expenses"
import { getCategoriesByTaxonomyList } from "@/lib/actions/categories"
import { getExpensesByProjectId } from "@/lib/actions/expenses"
import { getProjectTasks } from "@/lib/actions/project-tasks"
import { getProjectContext } from "@/lib/actions/project-context"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectExpensesPage({ params }: Props) {
  const { id } = await params
  const {
    session,
    project,
    owners,
    collaborators,
    permissions,
    isCurrentUserAdmin,
  } = await getProjectContext(id)

  const [expenses, tasks, expenseCategories] = await Promise.all([
    getExpensesByProjectId(id).catch(() => []),
    getProjectTasks(id),
    getCategoriesByTaxonomyList("expense"),
  ])

  const isOwner =
    owners.some((o) => o.userId === session.user.id) ||
    isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const canDelete =
    project.primaryOwnerId === session.user.id || isCurrentUserAdmin

  return (
    <ProjectExpenses
      expenses={expenses}
      tasks={tasks}
      projectId={project.id}
      budget={project.budget}
      categories={expenseCategories}
      canEdit={!!permissions.includes("expenses:create") || canEdit}
      canDelete={!!permissions.includes("expenses:delete") || canDelete}
      projectMembers={[...owners, ...collaborators]}
    />
  )
}
