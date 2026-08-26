import { ProjectDetails } from "@/components/projects/project-details"
import { getCategoriesByTaxonomyList } from "@/lib/actions/categories"
import { getProjectContext } from "@/lib/actions/project-context"
import { unwrapArray } from "@/lib/util/unwrap"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailsPage({ params }: Props) {
  const { id } = await params
  const { session, project, owners, permissions, isCurrentUserAdmin } =
    await getProjectContext(id)

  const categories = unwrapArray(
    await getCategoriesByTaxonomyList({ taxonomySlug: "project" })
  )

  const primaryOwner = owners.find(
    (o) => o.userId === project.primaryOwnerId
  )
  const isPrimaryOwner = project.primaryOwnerId === session.user.id
  const isOwner =
    owners.some((o) => o.userId === session.user.id) ||
    isCurrentUserAdmin
  const canEdit =
    (isOwner || isCurrentUserAdmin) &&
    permissions.includes("projects:edit")
  const canDelete = isPrimaryOwner || isCurrentUserAdmin

  return (
    <ProjectDetails
      project={project}
      categories={categories}
      primaryOwner={primaryOwner}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  )
}
