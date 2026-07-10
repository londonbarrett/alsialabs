import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden, notFound } from 'next/navigation'
import { getProjectById } from '@/lib/actions/projects'
import { getProjectTasks } from '@/lib/actions/project-tasks'
import { getProjectCategories } from '@/lib/actions/project-categories'
import { ProjectDetailView } from '@/components/projects/project-detail-view'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'projects', 'view'))) {
    forbidden()
  }

  let project
  try {
    project = await getProjectById(id)
  } catch {
    notFound()
  }

  const [tasks, permissions, categories] = await Promise.all([
    getProjectTasks(id),
    getUserPermissions(session.user.id),
    getProjectCategories(),
  ])

  return <ProjectDetailView project={project} tasks={tasks} permissions={permissions} categories={categories} />
}
