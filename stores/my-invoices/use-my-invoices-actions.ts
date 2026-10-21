"use client"

import { bindInvoiceToProject as bindInvoiceToProjectAction } from "@/actions/invoices"
import { useSettle } from "@/hooks/use-settle"
import { useOptimisticAction } from "@/stores/use-optimistic-action"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useMyInvoicesStore } from "./my-invoices-store"

/**
 * Every my-invoices mutation, so the my-invoices view never imports the
 * server actions directly. Runs through the my invoices store
 * (`MyInvoicesProvider`).
 */
export function useMyInvoicesActions() {
  const t = useTranslations()
  const settle = useSettle()
  const store = useMyInvoicesStore()
  const { run } = useOptimisticAction(store)

  const { executeAsync: executeBind } = useAction(
    bindInvoiceToProjectAction
  )

  async function bindToProject(
    invoiceId: string,
    projectId: string | null,
    projectName: string | null
  ): Promise<void> {
    const result = await run(
      { type: "bindProject", invoiceId, projectId, projectName },
      () => executeBind({ invoiceId, projectId }),
      {
        // The server returns only `{ id, projectId }`, so the display name
        // comes from the caller's dialog selection — the store never reads
        // another store's picker.
        commitAction: (r) =>
          r.data
            ? {
                type: "bindProject",
                invoiceId: r.data.id,
                projectId: r.data.projectId,
                projectName,
              }
            : undefined,
      }
    )
    settle(result, t("myInvoices.bindSuccess"))
  }

  return { bindToProject }
}
