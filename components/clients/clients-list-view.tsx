"use client"

import { ClientDialog } from "@/components/clients/client-dialog"
import { InviteDialog } from "@/components/clients/invite-dialog"
import { PageHeader } from "@/components/common/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { deleteClient, inviteClient } from "@/lib/actions/clients"
import type { Client } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { Plus, Search, Users } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ClientsTable } from "./clients-table"

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
  const translateError = useActionError()
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

  function handleSuccess(
    data: Omit<Client, "id" | "userId" | "store_id">
  ) {
    void data
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
      if (result.serverError) {
        toast.error(translateError(result.serverError.code))
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
    if (result.serverError) {
      toast.error(translateError(result.serverError.code))
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
      <PageHeader
        title={t("clients.title")}
        subtitle={t("clients.subtitle")}
        icon={Users}
      >
        <span className="text-sm text-muted-foreground">
          {clients.length} {t("clients.title").toLowerCase()}
        </span>
        <InputGroup className="w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={t("clients.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("clients.searchPlaceholder")}
          />
        </InputGroup>
        <Button onClick={openNew} aria-label={t("clients.newClient")}>
          <Plus />
          {t("clients.newClient")}
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <ClientsTable
            clients={filteredClients}
            permissions={permissions}
            onEdit={openEdit}
            onInvite={handleInvite}
            onDelete={async (client) => {
              const result = await deleteClient({ id: client.id })
              if (result.serverError) {
                toast.error(translateError(result.serverError.code))
              } else {
                toast.success(t("clients.clientDeleted"))
                router.refresh()
              }
            }}
            onView={(client) =>
              router.push("/dashboard/clients/" + client.id)
            }
          />
        </CardContent>
      </Card>

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
