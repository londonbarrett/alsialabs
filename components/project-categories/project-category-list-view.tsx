'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectCategoryDialog } from './project-category-dialog'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteProjectCategory } from '@/lib/actions/project-categories'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ProjectCategory } from '@/lib/drizzle/schema'

interface ProjectCategoryListViewProps {
  categories: ProjectCategory[]
  permissions?: string[]
}

export function ProjectCategoryListView({ categories, permissions = [] }: ProjectCategoryListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ProjectCategory | undefined>()

  function handleSuccess() {
    router.refresh()
    setEditingCategory(undefined)
  }

  function openNew() {
    setEditingCategory(undefined)
    setDialogOpen(true)
  }

  function openEdit(category: ProjectCategory) {
    setEditingCategory(category)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingCategory(undefined)
  }

  return (
    <>
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-muted-foreground">{t('project-categories.noCategories')}</p>
          <Button onClick={openNew} aria-label={t('project-categories.addCategory')}>
            <Plus />
            {t('project-categories.addCategory')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{t('project-categories.title')}</h1>
            <Button onClick={openNew} aria-label={t('project-categories.addCategory')}>
              <Plus />
              {t('project-categories.addCategory')}
            </Button>
          </div>

          <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label={t('project-categories.title')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('project-categories.slug')}</TableHead>
                  <TableHead scope="col">{t('project-categories.description')}</TableHead>
                  <TableHead scope="col">{t('project-categories.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="select-none" onDoubleClick={() => openEdit(cat)}>
                    <TableCell className="font-mono text-sm">{cat.slug}</TableCell>
                    <TableCell>{cat.description || '—'}</TableCell>
                    <TableCell>
                      <ActionMenu
                        entityName={cat.slug}
                        onEdit={() => openEdit(cat)}
                        onDelete={async () => {
                          const result = await deleteProjectCategory(cat.id)
                          if (!result.success) toast.error(result.error || t('common.somethingWentWrong'))
                          else toast.success(t('project-categories.categoryDeleted'))
                        }}
                        canDelete={permissions.includes('project-categories:delete')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <ProjectCategoryDialog
        category={editingCategory}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
