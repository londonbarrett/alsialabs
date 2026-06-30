'use client'

import { useState, useEffect } from 'react'
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
import { getInactiveClients } from '@/lib/actions/reports'

export interface InactiveClient {
  clientId: string
  clientName: string
  phone: string | null
  location: string | null
  lastInvoiceDate: string | null
}

const PERIODS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: 'none', label: 'No purchases' },
] as const

export function InactiveClientsTable() {
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
              <TableRow key={c.clientId}>
                <TableCell>{c.clientName}</TableCell>
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
    </div>
  )
}
