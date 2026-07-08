import { auth, getUserPermissions, hasPermission } from '@/lib/auth'
import { forbidden } from 'next/navigation'
import { getProjectCategories } from '@/lib/actions/project-categories'
import { ProjectCategoryListView } from '@/components/project-categories/project-category-list-view'

export default async function ProjectCategoriesPage() {
  const session = await auth()

  if (!session?.user?.id || !(await hasPermission(session.user.id, 'project-categories', 'view'))) {
    forbidden()
  }

  const [categories, permissions] = await Promise.all([
    getProjectCategories(),
    getUserPermissions(session.user.id),
  ])

  return <ProjectCategoryListView categories={categories} permissions={permissions} />
}
