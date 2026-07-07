'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { getInactiveClients } from '@/lib/actions/reports'

export interface InactiveClient {
  clientId: string
  clientName: string
  phone: string | null
  location: string | null
  lastInvoiceDate: string | null
}

export function InactiveClientsCard() {
  const router = useRouter()
  const [period, setPeriod] = useState('30')
  const [clients, setClients] = useState<InactiveClient[]>([])
  const [loading, setLoading] = useState(true)

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
        <CardTitle>Inactive Clients</CardTitle>
        <CardAction>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: '30', label: '30 days' },
                { value: '60', label: '60 days' },
                { value: '90', label: '90 days' },
                { value: 'none', label: 'No purchases' },
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
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : clients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Last Invoice</TableHead>
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
                  <TableCell>{c.phone ?? '-'}</TableCell>
                  <TableCell>{c.location ?? '-'}</TableCell>
                  <TableCell>{c.lastInvoiceDate ?? 'Never'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">All clients are active.</p>
        )}
      </CardContent>
    </Card>
  )
}
