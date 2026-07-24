"use client"

import { ClientActionMenu } from "@/components/clients/client-action-menu"
import { ClientDialog } from "@/components/clients/client-dialog"
import { InviteDialog } from "@/components/clients/invite-dialog"
import { PageHeader } from "@/components/common/page-header"
import { ImportButton } from "@/components/import-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { deleteClient, inviteClient } from "@/lib/actions/clients"
import type { Client } from "@/lib/drizzle/schema"
import { Plus, Search, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface ClientListViewProps {
  clients: Client[]
  permissions?: string[]
}

export function ClientListView({
  clients,
  permissions = [],
}: ClientListViewProps) {
  const router = useRouter()
  const t = useTranslations()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<
    Client | undefined
  >()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [invitingClient, setInvitingClient] = useState<
    Client | undefined
  >()
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients
    const query = searchQuery.toLowerCase()
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.phone.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.location?.toLowerCase().includes(query) ||
        client.comments?.toLowerCase().includes(query)
    )
  }, [clients, searchQuery])

  function handleSuccess() {
    router.refresh()
    setEditingClient(undefined)
  }

  function openNew() {
    setEditingClient(undefined)
    setDialogOpen(true)
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setDialogOpen(true)
  }

  async function handleInvite(client: Client) {
    if (client.email) {
      setInviting(true)
      const result = await inviteClient({ clientId: client.id })
      setInviting(false)
      if (!result.success) {
        toast.error(result.error || t("clients.failedToInvite"))
        return
      }
      router.refresh()
      toast.success(t("clients.clientInvited"))
      return
    }
    setInvitingClient(client)
    setInviteEmail("")
    setInviteDialogOpen(true)
  }

  async function handleInviteWithEmail() {
    if (!invitingClient) return
    setInviting(true)
    const result = await inviteClient({
      clientId: invitingClient.id,
      email: inviteEmail,
    })
    setInviting(false)
    if (!result.success) {
      toast.error(result.error || t("clients.failedToInvite"))
      return
    }
    setInviteDialogOpen(false)
    setInvitingClient(undefined)
    router.refresh()
    toast.success(t("clients.clientInvited"))
  }

  if (clients.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {t("clients.noClients")}
        </p>
        <div className="flex gap-2">
          <Button onClick={openNew} aria-label={t("clients.newClient")}>
            <Plus />
            {t("clients.newClient")}
          </Button>
          {/* <ImportButton onSuccess={() => router.refresh()} /> */}
        </div>
        <ClientDialog
          client={editingClient}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={handleSuccess}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <PageHeader title={t("clients.title")} subtitle={t("clients.subtitle")} icon={Users}>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("clients.searchPlaceholder")}
            className="w-64 pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("clients.searchPlaceholder")}
          />
        </div>
        <Button onClick={openNew} aria-label={t("clients.newClient")}>
          <Plus />
          {t("clients.newClient")}
        </Button>
        <ImportButton onSuccess={() => router.refresh()} />
      </PageHeader>

      <div
        className="max-h-[calc(100vh-10rem)] overflow-auto rounded-md border"
        role="region"
        aria-label={t("clients.title")}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("common.name")}</TableHead>
              <TableHead scope="col">{t("common.phone")}</TableHead>
              <TableHead scope="col">{t("clients.location")}</TableHead>
              <TableHead scope="col">{t("clients.comments")}</TableHead>
              <TableHead scope="col">{t("common.email")}</TableHead>
              <TableHead scope="col">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("clients.noResults")}
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="select-none"
                  onDoubleClick={() =>
                    router.push("/dashboard/clients/" + client.id)
                  }
                >
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.phone}</TableCell>
                  <TableCell>{client.location ?? "—"}</TableCell>
                  <TableCell>{client.comments ?? "—"}</TableCell>
                  <TableCell>{client.email ?? "—"}</TableCell>
                  <TableCell>
                    <ClientActionMenu
                      entityName={client.name}
                      onEdit={() => openEdit(client)}
                      onDelete={async () => {
                        const result = await deleteClient(client.id)
                        if (!result.success)
                          toast.error(
                            result.error || t("clients.failedToDelete")
                          )
                        else toast.success(t("clients.clientDeleted"))
                      }}
                      canDelete={permissions.includes("clients:delete")}
                      onView={() =>
                        router.push("/dashboard/clients/" + client.id)
                      }
                      onInvite={() => handleInvite(client)}
                      canInvite={permissions.includes("clients:invite")}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ClientDialog
        client={editingClient}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingClient(undefined)
        }}
        onSuccess={handleSuccess}
      />

      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        clientName={invitingClient?.name}
        email={inviteEmail}
        onEmailChange={setInviteEmail}
        submitting={inviting}
        onSubmit={handleInviteWithEmail}
      />
    </div>
  )
}
