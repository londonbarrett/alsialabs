import { ProjectView } from "@/components/projects/project-view"
import { getProjectContext } from "@/lib/actions/projects"
import { unwrapResponse } from "@/lib/util/unwrap"
import { forbidden, notFound } from "next/navigation"

interface Props {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export default async function ProjectDetailLayout({
  children,
  params,
}: Props) {
  const { id } = await params
  const result = await getProjectContext({ projectId: id })
  if (result.serverError?.code === "NOT_FOUND") notFound()
  if (result.serverError?.code === "FORBIDDEN") forbidden()
  if (!result.data) notFound()
  const { project } = unwrapResponse(result)

  return <ProjectView project={project}>{children}</ProjectView>
}
