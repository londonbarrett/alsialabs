"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { importClients } from "@/actions/not-safe/import-clients"
import { useActionError } from "@/lib/util/action-errors"

interface ImportButtonProps {
  onSuccess?: () => void
}

export function ImportButton({ onSuccess }: ImportButtonProps) {
  const t = useTranslations("import")
  const translateError = useActionError()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleFileUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const result = await importClients(formData)

      if (result.serverError || result.validationErrors) {
        toast.error(
          result.serverError
            ? translateError(result.serverError.code)
            : t("importFailed")
        )
      } else {
        toast.success(
          t("imported", { count: result.data?.importedCount ?? 0 })
        )
        onSuccess?.()
      }
    } catch {
      toast.error(t("importFailedUnexpected"))
    }

    setImporting(false)
    e.target.value = ""
  }

  return (
    <>
      <Button
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        aria-label={t("title")}
      >
        <Upload />
        {importing ? t("importing") : t("title")}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  )
}
