import { ExpensesProvider } from "@/components/projects/expenses/expenses-provider"
import { ProjectExpenses } from "@/components/projects/expenses/project-expenses"
import { ProjectTasksProvider } from "@/components/projects/project-tasks-provider"
import {
  getExpenseCategories,
  getExpensesByProjectId,
} from "@/actions/expenses"
import { getTasks } from "@/actions/tasks"
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
    <ExpensesProvider expenses={unwrapResponse(expenses)}>
      <ProjectTasksProvider tasks={unwrapResponse(tasksResult)}>
        <ProjectExpenses
          categories={unwrapResponse(expenseCategories)}
        />
      </ProjectTasksProvider>
    </ExpensesProvider>
  )
}
