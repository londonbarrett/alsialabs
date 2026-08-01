import { ProjectView } from "@/components/projects/project-view"
import { getProjectContext } from "@/lib/actions/project-context"

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectDetailLayout({
  children,
  params,
}: Props) {
  const { id } = await params
  const { project } = await getProjectContext(id)

  return (
    <ProjectView project={project}>{children}</ProjectView>
  )
}
