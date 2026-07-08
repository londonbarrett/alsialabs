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
import { ExpenseCategoryDialog } from './expense-category-dialog'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteExpenseCategory } from '@/lib/actions/expense-categories'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import type { ExpenseCategory } from '@/lib/drizzle/schema'

interface ExpenseCategoryListViewProps {
  categories: ExpenseCategory[]
  permissions?: string[]
}

export function ExpenseCategoryListView({ categories, permissions = [] }: ExpenseCategoryListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const tc = useTranslations('category-names')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | undefined>()

  function handleSuccess() {
    router.refresh()
    setEditingCategory(undefined)
  }

  function openNew() {
    setEditingCategory(undefined)
    setDialogOpen(true)
  }

  function openEdit(category: ExpenseCategory) {
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
          <p className="text-muted-foreground">{t('expense-categories.noCategories')}</p>
          {permissions.includes('categories:create') && (
            <Button onClick={openNew} aria-label={t('expense-categories.addCategory')}>
              <Plus />
              {t('expense-categories.addCategory')}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col p-6 gap-4 flex-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{t('expense-categories.title')}</h1>
            {permissions.includes('categories:create') && (
              <Button onClick={openNew} aria-label={t('expense-categories.addCategory')}>
                <Plus />
                {t('expense-categories.addCategory')}
              </Button>
            )}
          </div>

          <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label={t('expense-categories.title')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t('expense-categories.slug')}</TableHead>
                  <TableHead scope="col">{t('expense-categories.description')}</TableHead>
                  <TableHead scope="col">{t('expense-categories.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} className="select-none" onDoubleClick={() => openEdit(cat)}>
                    <TableCell className="font-mono text-sm">{tc(cat.slug)}</TableCell>
                    <TableCell>{cat.description || '—'}</TableCell>
                    <TableCell>
                      <ActionMenu
                        entityName={cat.slug}
                        onEdit={() => openEdit(cat)}
                        onDelete={async () => {
                          const result = await deleteExpenseCategory(cat.id)
                          if (!result.success) toast.error(result.error || t('common.somethingWentWrong'))
                          else toast.success(t('expense-categories.categoryDeleted'))
                        }}
                        canEdit={permissions.includes('categories:edit')}
                        canDelete={permissions.includes('categories:delete')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      <ExpenseCategoryDialog
        category={editingCategory}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </>
  )
}
