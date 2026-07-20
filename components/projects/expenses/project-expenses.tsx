'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Receipt, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Money } from '@/components/common/money'
import { ActionMenu } from '@/components/common/action-menu'
import { deleteExpense, type ExpenseWithCategory } from '@/lib/actions/expenses'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ExpenseDialog } from './expense-dialog'

interface ProjectExpensesProps {
  expenses: ExpenseWithCategory[]
  projectId: string
  budget: string | null
  categories: { id: string; slug: string }[]
  canEdit: boolean
  canDelete: boolean
}

export function ProjectExpenses({
  expenses,
  projectId,
  budget,
  categories,
  canEdit,
  canDelete,
}: ProjectExpensesProps) {
  const router = useRouter()
  const t = useTranslations()
  const tc = useTranslations('category-names')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | undefined>()

  function handleSuccess() {
    router.refresh()
    setEditingExpense(undefined)
  }

  function openNew() {
    setEditingExpense(undefined)
    setDialogOpen(true)
  }

  function openEdit(expense: ExpenseWithCategory) {
    setEditingExpense(expense)
    setDialogOpen(true)
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditingExpense(undefined)
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const budgetNum = budget ? Number(budget) : 0
  const spendPct = budgetNum > 0 ? Math.min(100, Math.round((total / budgetNum) * 100)) : 0
  const overBudget = budgetNum > 0 && total > budgetNum

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t('projects.expenses.title')}
          </span>
          {canEdit && (
            <Button onClick={openNew} size="sm">
              <Plus />
              {t('projects.expenses.addExpense')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {budgetNum > 0 && (
          <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <Wallet className="size-4 text-muted-foreground" />
                  {t('projects.card.budget')}
                </span>
                <span className={cn('tabular-nums', overBudget && 'text-red-600 dark:text-red-400')}>
                  <Money value={total} />{' '}
                  <span className="text-muted-foreground">/ <Money value={budgetNum} /></span>
                </span>
              </div>
              <Progress
                value={spendPct}
                className={cn(overBudget && '[&_[data-slot=progress-indicator]]:bg-red-500')}
              />
              <p className="text-xs text-muted-foreground">
                {t('projects.card.ofBudgetUsed', { pct: spendPct })}
                {overBudget && (
                  <span className="text-red-600 dark:text-red-400">
                    {' '}· {t('projects.card.overBudget')}
                  </span>
                )}
              </p>
            </div>
            <Separator className="my-4" />
          </>
        )}
        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('projects.expenses.noExpenses')}
          </p>
        ) : (
          <>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">
                      {t('projects.expenses.description')}
                    </TableHead>
                    <TableHead scope="col">
                      {t('projects.expenses.category')}
                    </TableHead>
                    <TableHead scope="col">
                      {t('projects.expenses.amount')}
                    </TableHead>
                    <TableHead scope="col">
                      {t('projects.expenses.date')}
                    </TableHead>
                    {(canEdit || canDelete) && (
                      <TableHead scope="col">
                        {t('common.actions')}
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.description}
                      </TableCell>
                      <TableCell>
                        {expense.categorySlug ? tc(expense.categorySlug) : '—'}
                      </TableCell>
                      <TableCell>
                        <Money value={expense.amount} />
                      </TableCell>
                      <TableCell>
                        {expense.expenseDate}
                      </TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <ActionMenu
                            entityName={expense.description}
                            onEdit={canEdit ? () => openEdit(expense) : undefined}
                            onDelete={async () => {
                              const result = await deleteExpense(expense.id, projectId)
                              if (!result.success) {
                                toast.error(result.error || t('common.somethingWentWrong'))
                              } else {
                                toast.success(t('projects.expenses.expenseDeleted'))
                              }
                            }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
              <p className="text-sm text-muted-foreground">
                {t('projects.expenses.total')}: <Money value={total} />
              </p>
            </div>
          </>
        )}
      </CardContent>

      <ExpenseDialog
        expense={editingExpense}
        projectId={projectId}
        categories={categories}
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />
    </Card>
  )
}
