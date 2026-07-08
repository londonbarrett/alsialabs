'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ProjectCategoryForm } from './project-category-form'
import type { ProjectCategory } from '@/lib/drizzle/schema'

interface ProjectCategoryDialogProps {
  category?: ProjectCategory
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ProjectCategoryDialog({ category, open, onOpenChange, onSuccess }: ProjectCategoryDialogProps) {
  const t = useTranslations('project-categories')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{category ? t('editCategory') : t('addCategory')}</DialogTitle>
          <DialogDescription>
            {category ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <ProjectCategoryForm
          category={category}
          onSuccess={() => {
            onSuccess()
            onOpenChange(false)
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
