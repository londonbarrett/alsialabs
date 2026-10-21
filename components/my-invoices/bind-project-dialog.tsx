"use client"

import type { MyInvoiceDTO } from "@/actions/schemas/invoice"
import { Dialog } from "@/components/common/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { useMyInvoicesState } from "@/stores/my-invoices/use-my-invoices-state"
import { cn } from "cn"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMyInvoicesActions } from "@/stores/my-invoices/use-my-invoices-actions"

interface BindProjectDialogProps {
  invoice: MyInvoiceDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BindProjectDialog({
  invoice,
  open,
  onOpenChange,
}: BindProjectDialogProps) {
  const t = useTranslations()
  const { bindToProject } = useMyInvoicesActions()
  const { projects } = useMyInvoicesState()
  // The parent remounts this dialog via `key` on every open, so the
  // initial state is always the invoice's current project.
  const [selected, setSelected] = useState<string | null>(
    invoice?.projectId ?? null
  )

  if (!invoice) return null
  const currentInvoice = invoice

  function handleConfirm() {
    onOpenChange(false)
    void bindToProject(
      currentInvoice.id,
      selected,
      selected === null
        ? null
        : (projects.find((p) => p.id === selected)?.name ?? null)
    )
  }

  return (
    <Dialog
      title={t("myInvoices.bindTitle")}
      description={t("myInvoices.bindDescription")}
      open={open}
      onOpenChange={onOpenChange}
    >
      {projects.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("myInvoices.noOwnedProjects")}
        </p>
      ) : (
        <ItemGroup>
          {projects.map((project) => (
            <Item
              key={project.id}
              size="sm"
              className={cn(
                "cursor-pointer hover:bg-muted/50",
                selected === project.id && "border-ring bg-muted/50"
              )}
              render={
                <button
                  type="button"
                  aria-pressed={selected === project.id}
                  onClick={() => setSelected(project.id)}
                />
              }
            >
              <ItemMedia variant="icon">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {project.name}
                  {project.categorySlug && (
                    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                      {t.has(`categoryNames.${project.categorySlug}`)
                        ? t(`categoryNames.${project.categorySlug}`)
                        : project.categoryName}
                    </Badge>
                  )}
                </ItemTitle>
                <ItemDescription>
                  {project.ownerName ?? t("common.unassigned")}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={selected === invoice.projectId}
        >
          {t("myInvoices.bind")}
        </Button>
      </div>
    </Dialog>
  )
}
