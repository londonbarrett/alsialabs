'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Bell, NotebookPen, Pencil } from 'lucide-react'
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
import { ClientDialog } from '@/components/clients/client-dialog'
import { getInactiveClients } from '@/lib/actions/activity'
import type { Client } from '@/lib/drizzle/schema'

export interface InactiveClient {
  clientId: string
  clientName: string
  email: string | null
  phone: string | null
  location: string | null
  comments: string | null
  userId: string | null
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
  const [editingClient, setEditingClient] = useState<Client | null>(null)

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
        <CardTitle>{t('activity.inactiveClients')}</CardTitle>
        <CardAction>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: '30', label: t('activity.days30') },
                { value: '60', label: t('activity.days60') },
                { value: '90', label: t('activity.days90') },
                { value: 'none', label: t('activity.noPurchases') },
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
                <TableHead>{t('activity.name')}</TableHead>
                <TableHead>{t('activity.email')}</TableHead>
                <TableHead>{t('activity.phone')}</TableHead>
                <TableHead>{t('activity.lastInvoice')}</TableHead>
                <TableHead>{t('activity.actions')}</TableHead>
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
                  <TableCell>{c.lastInvoiceDate ?? t('activity.never')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('clients.editClient')}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingClient({
                            id: c.clientId,
                            name: c.clientName,
                            phone: c.phone ?? '',
                            email: c.email,
                            location: c.location,
                            comments: c.comments,
                            userId: c.userId,
                          })
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={t('activity.logActivity')}
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
                        title={t('activity.addReminder')}
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
          <p className="text-muted-foreground text-sm">{t('activity.allClientsActive')}</p>
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
      {editingClient && (
        <ClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => {
            if (!open) setEditingClient(null)
          }}
          onSuccess={(data) => {
            setClients((prev) =>
              prev.map((c) =>
                c.clientId === editingClient.id
                  ? { ...c, clientName: data.name, phone: data.phone, email: data.email, location: data.location, comments: data.comments }
                  : c
              )
            )
            setEditingClient(null)
          }}
        />
      )}
    </Card>
  )
}
