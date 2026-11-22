import { ProjectTasksProvider } from "@/components/projects/tasks/project-tasks-provider"
import { TasksCard } from "@/components/projects/tasks/tasks-card"
import { getTasks } from "@/actions/tasks"
import { unwrapResponse } from "@/lib/util/unwrap"

interface Props {
  params: Promise<{ id: string }>
}

export default async function TasksPage({ params }: Props) {
  const { id } = await params
  const tasks = unwrapResponse(await getTasks({ projectId: id }))

  return (
    <ProjectTasksProvider tasks={tasks}>
      <TasksCard />
    </ProjectTasksProvider>
  )
}
