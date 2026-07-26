"use client"

import { useTranslations } from "next-intl"
import { FolderTree } from "lucide-react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { PageHeader } from "@/components/common/page-header"
import { CategoryListView } from "./category-list-view"
import type { Taxonomy } from "@/lib/drizzle/schema"

type CategoryItem = {
  id: string
  taxonomyId: string
  slug: string
  name: string
  description: string | null
}

interface TaxonomyTabsProps {
  taxonomies: Taxonomy[]
  categoriesByTaxonomy: Record<string, CategoryItem[]>
  permissions?: string[]
}

export function TaxonomyTabs({
  taxonomies,
  categoriesByTaxonomy,
  permissions = [],
}: TaxonomyTabsProps) {
  const t = useTranslations()
  const defaultSlug = taxonomies[0]?.slug ?? ""

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <PageHeader title={t("categories.title")} icon={FolderTree} />

      <Tabs className="gap-4" defaultValue={defaultSlug}>
        <TabsList>
          {taxonomies.map((taxonomy) => (
            <TabsTrigger key={taxonomy.id} value={taxonomy.slug}>
              {t.has(`taxonomyNames.${taxonomy.slug}`)
                ? t(`taxonomyNames.${taxonomy.slug}`)
                : taxonomy.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {taxonomies.map((taxonomy) => (
          <TabsContent key={taxonomy.id} value={taxonomy.slug}>
            <CategoryListView
              categories={categoriesByTaxonomy[taxonomy.id] ?? []}
              taxonomyId={taxonomy.id}
              taxonomyName={
                t.has(`taxonomyNames.${taxonomy.slug}`)
                  ? t(`taxonomyNames.${taxonomy.slug}`)
                  : taxonomy.name
              }
              permissions={permissions}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
