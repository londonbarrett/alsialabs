"use client"

import { Dialog } from "@/components/common/dialog"
import type { Category } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { CategoryForm } from "./category-form"

interface CategoryDialogProps {
  category?: Category
  taxonomyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CategoryDialog({
  category,
  taxonomyId,
  open,
  onOpenChange,
  onSuccess,
}: CategoryDialogProps) {
  const t = useTranslations("categories")
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? t("editCategory") : t("addCategory")}
      description={category ? t("updateDetails") : t("fillDetails")}
    >
      <CategoryForm
        category={category}
        taxonomyId={taxonomyId}
        onSuccess={() => {
          onSuccess()
          onOpenChange(false)
        }}
        onCancel={() => onOpenChange(false)}
      />
    </Dialog>
  )
}
