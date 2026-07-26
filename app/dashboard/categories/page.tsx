import { TaxonomyTabs } from "@/components/categories/taxonomy-tabs"
import {
  getCategoriesByTaxonomy,
  getTaxonomies,
} from "@/lib/actions/categories"
import { auth, getUserPermissions } from "@/lib/auth"
import { forbidden } from "next/navigation"

export default async function CategoriesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    forbidden()
  }

  const permissions = await getUserPermissions(session.user.id)

  if (!permissions.includes("categories:view")) {
    forbidden()
  }

  const taxonomies = await getTaxonomies()

  const categoriesResults = await Promise.all(
    taxonomies.map((t) => getCategoriesByTaxonomy(t.slug))
  )

  const categoriesByTaxonomy: Record<
    string,
    (typeof categoriesResults)[number]
  > = {}
  taxonomies.forEach((t, i) => {
    categoriesByTaxonomy[t.id] = categoriesResults[i]
  })

  return (
    <TaxonomyTabs
      taxonomies={taxonomies}
      categoriesByTaxonomy={categoriesByTaxonomy}
      permissions={permissions}
    />
  )
}
