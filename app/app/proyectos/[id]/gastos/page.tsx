import { ProjectExpenses } from "@/components/projects/expenses/project-expenses"
import {
  getExpenseCategories,
  getExpensesByProjectId,
} from "@/lib/actions/expenses"
import { getTasks } from "@/lib/actions/tasks"
import { unwrapResponse } from "@/lib/util/unwrap"

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProjectExpensesPage({ params }: Props) {
  const { id } = await params
  const [expenses, tasksResult, expenseCategories] = await Promise.all([
    getExpensesByProjectId({ projectId: id }),
    getTasks({ projectId: id }),
    getExpenseCategories(),
  ])

  return (
    <ProjectExpenses
      expenses={unwrapResponse(expenses)}
      tasks={unwrapResponse(tasksResult)}
      categories={unwrapResponse(expenseCategories)}
    />
  )
}
