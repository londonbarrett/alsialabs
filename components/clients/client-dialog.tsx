'use client'

import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ClientForm } from '@/components/clients/client-form'
import type { Client } from '@/lib/drizzle/schema'

interface ClientDialogProps {
  client?: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ClientDialog({ client, open, onOpenChange, onSuccess }: ClientDialogProps) {
  const t = useTranslations('clients')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? t('editClient') : t('newClient')}</DialogTitle>
          <DialogDescription>
            {client ? t('updateDetails') : t('fillDetails')}
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          client={client}
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
