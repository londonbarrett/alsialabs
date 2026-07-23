'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, NotebookPen } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LogActivityDialog } from '@/components/clients/log-activity-dialog'
import { ReminderDialog } from '@/components/clients/reminder-dialog'
import { getInactiveClients } from '@/lib/actions/reports'

export interface InactiveClient {
  clientId: string
  clientName: string
  email: string | null
  phone: string | null
  lastInvoiceDate: string | null
}

export function InactiveClientsCard() {
  const router = useRouter()
  const t = useTranslations()
  const [period, setPeriod] = useState('30')
  const [clients, setClients] = useState<InactiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const [activityClientId, setActivityClientId] = useState<string | null>(null)
  const [reminderClientId, setReminderClientId] = useState<string | null>(null)

  useEffect(() => {
    getInactiveClients(period === 'none' ? null : Number(period))
      .then(setClients)
      .finally(() => setLoading(false))
  }, [period])

  function handlePeriodChange(value: string) {
    setPeriod(value)
    setLoading(true)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('reports.inactiveClients')}</CardTitle>
        <CardAction>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: '30', label: t('reports.days30') },
                { value: '60', label: t('reports.days60') },
                { value: '90', label: t('reports.days90') },
                { value: 'none', label: t('reports.noPurchases') },
              ].map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
        ) : clients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.name')}</TableHead>
                <TableHead>{t('reports.email')}</TableHead>
                <TableHead>{t('reports.phone')}</TableHead>
                <TableHead>{t('reports.lastInvoice')}</TableHead>
                <TableHead className="w-24"><span className="sr-only">{t('reports.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow
                  key={c.clientId}
                  className="cursor-default"
                  onDoubleClick={() => router.push(`/dashboard/clients/${c.clientId}`)}
                >
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${c.clientId}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {c.clientName}
                    </Link>
                  </TableCell>
                  <TableCell>{c.email ?? '-'}</TableCell>
                  <TableCell>{c.phone ?? '-'}</TableCell>
                  <TableCell>{c.lastInvoiceDate ?? t('reports.never')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('reports.logActivity')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setActivityClientId(c.clientId)
                        }}
                      >
                        <NotebookPen />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('reports.addReminder')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setReminderClientId(c.clientId)
                        }}
                      >
                        <Bell />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">{t('reports.allClientsActive')}</p>
        )}
      </CardContent>
      {activityClientId && (
        <LogActivityDialog
          clientId={activityClientId}
          open={!!activityClientId}
          onOpenChange={(open) => {
            if (!open) setActivityClientId(null)
          }}
          onSuccess={() => {
            setActivityClientId(null)
            router.refresh()
          }}
        />
      )}
      {reminderClientId && (
        <ReminderDialog
          clientId={reminderClientId}
          open={!!reminderClientId}
          onOpenChange={(open) => {
            if (!open) setReminderClientId(null)
          }}
          onSuccess={() => {
            setReminderClientId(null)
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
