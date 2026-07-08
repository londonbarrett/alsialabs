import { auth, getUserPermissions } from "@/lib/auth"
import { forbidden } from "next/navigation"
import { getProjectCategories } from "@/lib/actions/project-categories"
import { getExpenseCategories } from "@/lib/actions/expense-categories"
import { ProjectCategoryListView } from "@/components/project-categories/project-category-list-view"
import { ExpenseCategoryListView } from "@/components/expense-categories/expense-category-list-view"

export default async function CategoriesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    forbidden()
  }

  const permissions = await getUserPermissions(session.user.id)

  if (!permissions.includes("categories:view")) {
    forbidden()
  }

  const [projectCategories, expenseCategories] = await Promise.all([
    getProjectCategories(),
    getExpenseCategories(),
  ])

  return (
    <div className="flex flex-col">
      <ProjectCategoryListView
        categories={projectCategories}
        permissions={permissions}
      />
      <ExpenseCategoryListView
        categories={expenseCategories}
        permissions={permissions}
      />
    </div>
  )
}
