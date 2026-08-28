import { ProjectExpenses } from "@/components/projects/expenses/project-expenses"
import {
  getExpenseCategories,
  getExpensesByProjectId,
} from "@/lib/actions/expenses"
import { getProjectContext } from "@/lib/actions/project-context"
import { getTasks } from "@/lib/actions/tasks"
import { unwrapArray } from "@/lib/util/unwrap"

type Props = {
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

  const [expenses, tasksResult, expenseCategories] = await Promise.all([
    getExpensesByProjectId({ projectId: id }),
    getTasks({ projectId: id }),
    getExpenseCategories(),
  ])
  const tasks = unwrapArray(tasksResult)

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
      expenses={unwrapArray(expenses)}
      tasks={tasks}
      projectId={project.id}
      budget={project.budget}
      categories={unwrapArray(expenseCategories)}
      canEdit={!!permissions.includes("expenses:create") || canEdit}
      canDelete={!!permissions.includes("expenses:delete") || canDelete}
      projectMembers={[...owners, ...collaborators]}
    />
  )
}
