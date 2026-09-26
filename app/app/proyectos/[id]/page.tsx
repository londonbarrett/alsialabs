import { TasksCard } from "@/components/projects/tasks-card"
import { getTasks } from "@/lib/actions/tasks"
import { unwrapResponse } from "@/lib/util/unwrap"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TasksPage({ params }: Props) {
  const { id } = await params
  const tasks = unwrapResponse(await getTasks({ projectId: id }))

  return <TasksCard initialTasks={tasks} />
}
