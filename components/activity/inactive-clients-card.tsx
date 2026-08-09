"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getInactiveClients } from "@/lib/actions/activity"
import { useTranslations } from "next-intl"
import { use, useState } from "react"
import {
  ClientActivityRow,
  type InactiveClient,
} from "./client-activity-row"

const PERIOD_OPTIONS = [
  { value: "30", labelKey: "days30" },
  { value: "60", labelKey: "days60" },
  { value: "90", labelKey: "days90" },
  { value: "none", labelKey: "noPurchases" },
] as const

function fetchClients(periodValue: string) {
  return getInactiveClients(
    periodValue === "none" ? null : Number(periodValue)
  )
}

interface InactiveClientsCardProps {
  initialClients: Promise<InactiveClient[]>
  defaultPeriod: string
}

export function InactiveClientsCard({
  initialClients,
  defaultPeriod,
}: InactiveClientsCardProps) {
  const t = useTranslations()
  const initialData = use(initialClients)
  const [period, setPeriod] = useState(defaultPeriod)
  const [clients, setClients] = useState<InactiveClient[]>(initialData)
  const [loading, setLoading] = useState(false)

  async function handlePeriodChange(value: string) {
    setPeriod(value)
    setLoading(true)
    try {
      const result = await fetchClients(value)
      setClients(result)
    } finally {
      setLoading(false)
    }
  }

  function handleClientChange(
    clientId: string,
    patch: Partial<InactiveClient>
  ) {
    setClients((prev) =>
      prev.map((c) =>
        c.clientId === clientId ? { ...c, ...patch } : c
      )
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activity.inactiveClients")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-end gap-3">
            <p
              className="mr-auto self-center text-sm text-muted-foreground"
              aria-live="polite"
            >
              {t("activity.resultCount", { count: clients.length })}
            </p>
            <div className="grid gap-1.5">
              <Label
                htmlFor="period-select"
                className="text-xs text-muted-foreground"
              >
                {t("activity.period")}
              </Label>
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger id="period-select" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {t(`activity.${p.labelKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : clients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activity.name")}</TableHead>
                  <TableHead>{t("activity.email")}</TableHead>
                  <TableHead>{t("activity.phone")}</TableHead>
                  <TableHead>{t("activity.lastInvoice")}</TableHead>
                  <TableHead>{t("activity.activities")}</TableHead>
                  <TableHead>{t("activity.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <ClientActivityRow
                    key={c.clientId}
                    client={c}
                    onClientChange={handleClientChange}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {t("activity.allClientsActive")}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
