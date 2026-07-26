'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CategoryDialog } from './category-dialog'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteCategory } from '@/lib/actions/categories'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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

export function CategoryListView({ categories, taxonomyId, taxonomyName, permissions = [] }: CategoryListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryItem | undefined>()
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(categories)

  const handleCategoriesChange = useCallback((updater: (prev: CategoryItem[]) => CategoryItem[]) => {
    setLocalCategories(updater)
  }, [])

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

  async function handleDelete(category: CategoryItem) {
    handleCategoriesChange((prev) => prev.filter((c) => c.id !== category.id))
    const result = await deleteCategory(category.id)
    if (!result.success) {
      handleCategoriesChange((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)))
      toast.error(result.error || t('common.somethingWentWrong'))
    } else {
      toast.success(t('categories.categoryDeleted'))
    }
  }

  return (
    <>
      {localCategories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-full gap-4 py-12">
            <p className="text-muted-foreground">{t('categories.noCategories')}</p>
            {permissions.includes('categories:create') && (
              <Button onClick={openNew} aria-label={t('categories.addCategory')}>
                <Plus />
                {t('categories.addCategory')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {taxonomyName}
              {permissions.includes('categories:create') && (
                <Button onClick={openNew} size="sm" aria-label={t('categories.addCategory')}>
                  <Plus />
                  {t('categories.addCategory')}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[calc(100vh-14rem)]" role="region" aria-label={taxonomyName}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">{t('categories.name')}</TableHead>
                    <TableHead scope="col">{t('categories.slug')}</TableHead>
                    <TableHead scope="col">{t('categories.description')}</TableHead>
                    <TableHead scope="col">{t('categories.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localCategories.map((cat) => (
                    <TableRow key={cat.id} className="select-none" onDoubleClick={() => openEdit(cat)}>
                      <TableCell className="font-medium">
                        {t.has(`categoryNames.${cat.slug}`)
                          ? t(`categoryNames.${cat.slug}`)
                          : cat.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{cat.slug}</TableCell>
                      <TableCell>{cat.description || '—'}</TableCell>
                      <TableCell>
                        <ActionMenu
                          entityName={cat.name}
                          onEdit={() => openEdit(cat)}
                          onDelete={() => handleDelete(cat)}
                          canEdit={permissions.includes('categories:edit')}
                          canDelete={permissions.includes('categories:delete')}
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
