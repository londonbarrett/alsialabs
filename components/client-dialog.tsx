'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ClientForm } from '@/components/client-form'
import type { Client } from '@/lib/drizzle/schema'

interface ClientDialogProps {
  client?: Client
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ClientDialog({ client, open, onOpenChange, onSuccess }: ClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'New Client'}</DialogTitle>
          <DialogDescription>
            {client ? 'Update the client details below.' : 'Fill in the details to create a new client.'}
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
