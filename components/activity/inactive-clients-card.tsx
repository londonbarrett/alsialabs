"use client"

import { ClientDialog } from "@/components/clients/client-dialog"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
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
import type { Client } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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

export function InactiveClientsCard() {
  const router = useRouter()
  const t = useTranslations()
  const [period, setPeriod] = useState("30")
  const [clients, setClients] = useState<InactiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const [activityClientId, setActivityClientId] = useState<
    string | null
  >(null)
  const [reminderClientId, setReminderClientId] = useState<
    string | null
  >(null)
  const [editingClient, setEditingClient] = useState<Client | null>(
    null
  )

  useEffect(() => {
    getInactiveClients(period === "none" ? null : Number(period))
      .then(setClients)
      .finally(() => setLoading(false))
  }, [period])

  function handlePeriodChange(value: string) {
    setPeriod(value)
    setLoading(true)
  }

  function handleEditClient(client: InactiveClient) {
    setEditingClient({
      id: client.clientId,
      name: client.clientName,
      phone: client.phone ?? "",
      email: client.email,
      location: client.location,
      comments: client.comments,
      userId: client.userId,
      store_id: null,
    })
  }

  function handleLogActivity(client: InactiveClient) {
    setActivityClientId(client.clientId)
  }

  function handleAddReminder(client: InactiveClient) {
    setReminderClientId(client.clientId)
  }

  function handleActivityDialogOpenChange(open: boolean) {
    if (!open) setActivityClientId(null)
  }

  function handleActivityDialogSuccess() {
    setActivityClientId(null)
    router.refresh()
  }

  function handleReminderDialogOpenChange(open: boolean) {
    if (!open) setReminderClientId(null)
  }

  function handleReminderDialogSuccess() {
    setReminderClientId(null)
    router.refresh()
  }

  function handleEditDialogOpenChange(open: boolean) {
    if (!open) setEditingClient(null)
  }

  function handleEditDialogSuccess(
    data: Omit<Client, "id" | "store_id" | "userId">
  ) {
    setClients((prev) =>
      prev.map((c) =>
        c.clientId === editingClient?.id
          ? {
              ...c,
              clientName: data.name,
              phone: data.phone,
              email: data.email,
              location: data.location,
              comments: data.comments,
            }
          : c
      )
    )
    setEditingClient(null)
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
                  <TableHead>{t("activity.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <ClientActivityRow
                    key={c.clientId}
                    client={c}
                    onEdit={handleEditClient}
                    onLogActivity={handleLogActivity}
                    onAddReminder={handleAddReminder}
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
      {activityClientId && (
        <LogActivityDialog
          clientId={activityClientId}
          open={!!activityClientId}
          onOpenChange={handleActivityDialogOpenChange}
          onSuccess={handleActivityDialogSuccess}
        />
      )}
      {reminderClientId && (
        <ReminderDialog
          clientId={reminderClientId}
          open={!!reminderClientId}
          onOpenChange={handleReminderDialogOpenChange}
          onSuccess={handleReminderDialogSuccess}
        />
      )}
      {editingClient && (
        <ClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={handleEditDialogOpenChange}
          onSuccess={handleEditDialogSuccess}
        />
      )}
    </Card>
  )
}
