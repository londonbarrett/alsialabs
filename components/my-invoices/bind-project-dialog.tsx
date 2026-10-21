"use client"

import type { MyInvoiceDTO } from "@/actions/schemas/invoice"
import { Dialog } from "@/components/common/dialog"
import { Button } from "@/components/ui/button"
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

function optionClassName(selected: boolean) {
  return cn(
    "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
    selected
      ? "border-ring bg-muted ring-2 ring-ring/50"
      : "border-border hover:bg-muted/50"
  )
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
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-pressed={selected === null}
            className={optionClassName(selected === null)}
            onClick={() => setSelected(null)}
          >
            {t("myInvoices.noProject")}
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              aria-pressed={selected === project.id}
              className={optionClassName(selected === project.id)}
              onClick={() => setSelected(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={selected === invoice.projectId}
        >
          {selected === null
            ? t("myInvoices.clear")
            : t("myInvoices.bind")}
        </Button>
      </div>
    </Dialog>
  )
}
