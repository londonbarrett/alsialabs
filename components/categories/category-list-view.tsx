"use client"

import { ActionMenu } from "@/components/common/action-menu"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteCategory } from "@/lib/actions/categories"
import { useActionError } from "@/lib/util/action-errors"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useOptimisticAction } from "next-safe-action/hooks"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { CategoryDialog } from "./category-dialog"

type CategoryItem = {
  id: string
  taxonomyId: string
  slug: string
  name: string
  description: string | null
}

interface CategoryListViewProps {
  categories: CategoryItem[]
  taxonomyId: string
  taxonomyName: string
  permissions?: string[]
}

export function CategoryListView({
  categories,
  taxonomyId,
  taxonomyName,
  permissions = [],
}: CategoryListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const translateError = useActionError()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<
    CategoryItem | undefined
  >()

  const { execute, optimisticState } = useOptimisticAction(
    deleteCategory,
    {
      currentState: categories,
      updateFn: (currentCategories, { id }) => {
        return currentCategories.filter((c) => c.id !== id)
      },
      onSuccess: () => {
        toast.success(t("categories.categoryDeleted"))
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(translateError(error.serverError.code))
        }
        router.refresh()
      },
    }
  )

  function handleSuccess() {
    router.refresh()
    setEditingCategory(undefined)
  }

  function openNew() {
    setEditingCategory(undefined)
    setDialogOpen(true)
  }

  function openEdit(category: CategoryItem) {
    setEditingCategory(category)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingCategory(undefined)
  }

  return (
    <>
      {optimisticState.length === 0 ? (
        <Card>
          <CardContent className="flex h-full flex-col items-center justify-center gap-4 py-12">
            <p className="text-muted-foreground">
              {t("categories.noCategories")}
            </p>
            {permissions.includes("categories:create") && (
              <Button
                onClick={openNew}
                aria-label={t("categories.addCategory")}
              >
                <Plus />
                {t("categories.addCategory")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {taxonomyName}
              {permissions.includes("categories:create") && (
                <Button
                  onClick={openNew}
                  size="sm"
                  aria-label={t("categories.addCategory")}
                >
                  <Plus />
                  {t("categories.addCategory")}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="max-h-[calc(100vh-14rem)] overflow-auto rounded-md border"
              role="region"
              aria-label={taxonomyName}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">
                      {t("categories.name")}
                    </TableHead>
                    <TableHead scope="col">
                      {t("categories.slug")}
                    </TableHead>
                    <TableHead scope="col">
                      {t("categories.description")}
                    </TableHead>
                    <TableHead scope="col">
                      {t("categories.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optimisticState.map((cat) => (
                    <TableRow
                      key={cat.id}
                      className="select-none"
                      onDoubleClick={() => openEdit(cat)}
                    >
                      <TableCell className="font-medium">
                        {t.has(`categoryNames.${cat.slug}`)
                          ? t(`categoryNames.${cat.slug}`)
                          : cat.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {cat.slug}
                      </TableCell>
                      <TableCell>{cat.description || "—"}</TableCell>
                      <TableCell>
                        <ActionMenu
                          entityName={cat.name}
                          onEdit={() => openEdit(cat)}
                          onDelete={() => {
                            execute({ id: cat.id })
                            return Promise.resolve()
                          }}
                          canEdit={permissions.includes(
                            "categories:edit"
                          )}
                          canDelete={permissions.includes(
                            "categories:delete"
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <CategoryDialog
        category={editingCategory}
        taxonomyId={taxonomyId}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
