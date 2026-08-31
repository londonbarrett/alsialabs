import { ProjectView } from "@/components/projects/project-view"
import { getProjectContext } from "@/lib/actions/projects"
import { unwrapResponse } from "@/lib/util/unwrap"

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectDetailLayout({
  children,
  params,
}: Props) {
  const { id } = await params
  const { project } = unwrapResponse(
    await getProjectContext({ projectId: id })
  )

  return <ProjectView project={project}>{children}</ProjectView>
}
