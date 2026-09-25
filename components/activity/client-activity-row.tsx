"use client"

import { ActivityItem } from "@/components/clients/activity-item"
import { ClientDialog } from "@/components/clients/client-dialog"
import { LogActivityDialog } from "@/components/clients/log-activity-dialog"
import { ReminderDialog } from "@/components/clients/reminder-dialog"
import { ReminderItem } from "@/components/clients/reminder-item"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { TableCell, TableRow } from "@/components/ui/table"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  getClientTimelinePage,
  type ClientTimelineEntry,
} from "@/lib/actions/client-timeline"
import type { Client } from "@/lib/drizzle/schema"
import { cn } from "cn"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  NotebookPen,
  Pencil,
} from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export interface InactiveClient {
  clientId: string
  clientName: string
  email: string | null
  phone: string | null
  location: string | null
  comments: string | null
  userId: string | null
  lastInvoiceDate: string | null
  activityCount: number
}

interface ClientActivityRowProps {
  client: InactiveClient
  onClientChange: (
    clientId: string,
    patch: Partial<InactiveClient>
  ) => void
}

type RowDialog = "edit" | "activity" | "reminder"

const PAGE_SIZE = 5

export function ClientActivityRow({
  client,
  onClientChange,
}: ClientActivityRowProps) {
  const t = useTranslations()
  const router = useRouter()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [dialog, setDialog] = useState<RowDialog | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [entries, setEntries] = useState<ClientTimelineEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  async function loadFirstPage() {
    setIsLoading(true)
    startLoading()
    try {
      const result = await getClientTimelinePage(client.clientId, {
        offset: 0,
        limit: PAGE_SIZE,
      })
      setEntries(result.entries)
      setHasMore(result.hasMore)
      setLoaded(true)
    } finally {
      setIsLoading(false)
      stopLoading()
    }
  }

  async function loadMore() {
    setIsLoadingMore(true)
    startLoading()
    try {
      const result = await getClientTimelinePage(client.clientId, {
        offset: entries.length,
        limit: PAGE_SIZE,
      })
      setEntries((prev) => [...prev, ...result.entries])
      setHasMore(result.hasMore)
    } finally {
      setIsLoadingMore(false)
      stopLoading()
    }
  }

  function toggleRow() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)
    if (!loaded) {
      loadFirstPage()
    }
  }

  function handleToggleClick() {
    toggleRow()
  }

  function handleEditClick() {
    setDialog("edit")
  }

  function handleLogActivityClick() {
    setDialog("activity")
  }

  function handleAddReminderClick() {
    setDialog("reminder")
  }

  function handleEditSuccess(
    data: Omit<Client, "id" | "userId" | "store_id">
  ) {
    setDialog(null)
    onClientChange(client.clientId, {
      clientName: data.name,
      phone: data.phone,
      email: data.email,
      location: data.location,
      comments: data.comments,
    })
    router.refresh()
  }

  function toClient(c: InactiveClient): Client {
    return {
      id: c.clientId,
      name: c.clientName,
      phone: c.phone ?? "",
      email: c.email,
      location: c.location,
      comments: c.comments,
      userId: c.userId,
      store_id: null,
    }
  }

  return (
    <>
      <TableRow
        className={cn("cursor-default", expanded && "bg-muted/50")}
        onDoubleClick={toggleRow}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("activity.toggleActivities", {
                name: client.clientName,
              })}
              aria-expanded={expanded}
              onClick={handleToggleClick}
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </Button>
            <Link
              href={`/app/clientes/${client.clientId}`}
              className="hover:underline"
            >
              {client.clientName}
            </Link>
          </div>
        </TableCell>
        <TableCell>{client.email ?? "-"}</TableCell>
        <TableCell>{client.phone ?? "-"}</TableCell>
        <TableCell>
          {client.lastInvoiceDate ?? t("activity.never")}
        </TableCell>
        <TableCell>{client.activityCount}</TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title={t("clients.editClient")}
              onClick={handleEditClick}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t("activity.logActivity")}
              onClick={handleLogActivityClick}
            >
              <NotebookPen />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t("activity.addReminder")}
              onClick={handleAddReminderClick}
            >
              <Bell />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 px-6 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {t("activity.recentActivity")}
              </h3>
              <ChevronDown className="size-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Spinner />
                {t("activity.loadingActivities")}
              </div>
            ) : entries.length > 0 ? (
              <div className="py-1">
                {entries.map((entry) =>
                  entry.kind === "activity" ? (
                    <ActivityItem
                      key={entry.id}
                      activity={entry}
                      clientId={client.clientId}
                      readOnly
                    />
                  ) : (
                    <ReminderItem
                      key={entry.id}
                      reminder={entry}
                      clientId={client.clientId}
                      readOnly
                    />
                  )
                )}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore && <Spinner />}
                      {t("activity.loadMoreActivities")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                {t("activity.noActivities")}
              </p>
            )}
          </TableCell>
        </TableRow>
      )}
      {dialog === "edit" && (
        <ClientDialog
          client={toClient(client)}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}
      <LogActivityDialog
        clientId={client.clientId}
        open={dialog === "activity"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
      <ReminderDialog
        clientId={client.clientId}
        open={dialog === "reminder"}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      />
    </>
  )
}
