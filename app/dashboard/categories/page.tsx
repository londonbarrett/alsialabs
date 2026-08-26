import { TaxonomyTabs } from "@/components/categories/taxonomy-tabs"
import {
  getCategoriesByTaxonomy,
  getTaxonomies,
} from "@/lib/actions/categories"
import { auth, getUserPermissions } from "@/lib/auth"
import { forbidden } from "next/navigation"
import { unwrapArray } from "@/lib/util/unwrap"

type CategoryItem = {
  id: string
  taxonomyId: string
  slug: string
  name: string
  description: string | null
}

export default async function CategoriesPage() {
  const session = await auth()

  if (!session?.user?.id) {
    forbidden()
  }

  const permissions = await getUserPermissions(session.user.id)

  if (!permissions.includes("categories:view")) {
    forbidden()
  }

  const taxonomies = unwrapArray(await getTaxonomies())

  const categoriesResults = await Promise.all(
    taxonomies.map((t) =>
      getCategoriesByTaxonomy({ taxonomySlug: t.slug })
    )
  )

  const categoriesByTaxonomy: Record<string, CategoryItem[]> = {}
  taxonomies.forEach((t, i) => {
    categoriesByTaxonomy[t.id] = unwrapArray(categoriesResults[i])
  })

  return (
    <TaxonomyTabs
      taxonomies={taxonomies}
      categoriesByTaxonomy={categoriesByTaxonomy}
      permissions={permissions}
    />
  )
}
