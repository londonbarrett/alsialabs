'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importClients } from '@/lib/actions/import-clients'

interface ImportButtonProps {
  onSuccess?: () => void
}

export function ImportButton({ onSuccess }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await importClients(formData)

      if (result.success) {
        toast.success(`Imported ${result.importedCount} client(s)`)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed unexpectedly')
    }

    setImporting(false)
    e.target.value = ''
  }

  return (
    <>
      <Button
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import data"
      >
        <Upload />
        {importing ? 'Importing...' : 'Import data'}
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
