"use client"

import { useState, type MouseEvent } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import {
  Bell,
  ChevronDown,
  ChevronRight,
  NotebookPen,
  Pencil,
} from "lucide-react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ActivityItem } from "@/components/clients/activity-item"
import { getClientActivityPage } from "@/lib/actions/activities"
import type { ClientActivity } from "@/lib/drizzle/schema"
import { cn } from "@/lib/utils"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"

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

interface ClientActivityRowProps {
  client: InactiveClient
  onEdit: (client: InactiveClient) => void
  onLogActivity: (client: InactiveClient) => void
  onAddReminder: (client: InactiveClient) => void
}

const PAGE_SIZE = 5

export function ClientActivityRow({
  client,
  onEdit,
  onLogActivity,
  onAddReminder,
}: ClientActivityRowProps) {
  const t = useTranslations()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [activities, setActivities] = useState<ClientActivity[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  async function loadFirstPage() {
    setIsLoading(true)
    startLoading()
    try {
      const result = await getClientActivityPage(client.clientId, {
        offset: 0,
        limit: PAGE_SIZE,
      })
      setActivities(result.activities)
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
      const result = await getClientActivityPage(client.clientId, {
        offset: activities.length,
        limit: PAGE_SIZE,
      })
      setActivities((prev) => [...prev, ...result.activities])
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

  function handleToggleClick(e: MouseEvent) {
    e.stopPropagation()
    toggleRow()
  }

  function handleClientNameClick(e: MouseEvent) {
    e.stopPropagation()
  }

  function handleEditClick(e: MouseEvent) {
    e.stopPropagation()
    onEdit(client)
  }

  function handleLogActivityClick(e: MouseEvent) {
    e.stopPropagation()
    onLogActivity(client)
  }

  function handleAddReminderClick(e: MouseEvent) {
    e.stopPropagation()
    onAddReminder(client)
  }

  function handleNoop() {}

  async function handleNoopAsync() {}

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
              href={`/dashboard/clients/${client.clientId}`}
              className="hover:underline"
              onClick={handleClientNameClick}
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
          <TableCell colSpan={5} className="bg-muted/30 px-6 py-3">
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
            ) : activities.length > 0 ? (
              <div className="py-1">
                {activities.map((a) => (
                  <ActivityItem
                    key={a.id}
                    activity={a}
                    onEdit={handleNoop}
                    onDelete={handleNoopAsync}
                    canEdit={false}
                    canDelete={false}
                  />
                ))}
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
    </>
  )
}
