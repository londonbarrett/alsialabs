'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientName: string | undefined
  email: string
  onEmailChange: (email: string) => void
  submitting: boolean
  onSubmit: () => void
}

export function InviteDialog({
  open,
  onOpenChange,
  clientName,
  email,
  onEmailChange,
  submitting,
  onSubmit,
}: InviteDialogProps) {
  const t = useTranslations()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('clients.inviteClient')}</DialogTitle>
          <DialogDescription>
            {t('clients.inviteDescription', { name: clientName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">{t('clients.email')}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t('clients.emailPlaceholder')}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !email}>
            {submitting ? t('clients.inviting') : t('clients.sendInvitation')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
