'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImportButton } from '@/components/import-button'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ClientActionMenu } from '@/components/clients/client-action-menu'
import { InviteDialog } from '@/components/clients/invite-dialog'
import { deleteClient, inviteClient } from '@/lib/actions/clients'
import { toast } from 'sonner'
import type { Client } from '@/lib/drizzle/schema'
import { useRouter } from 'next/navigation'

interface ClientListViewProps {
  clients: Client[]
  permissions?: string[]
}

export function ClientListView({ clients, permissions = [] }: ClientListViewProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | undefined>()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [invitingClient, setInvitingClient] = useState<Client | undefined>()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

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
        toast.error(result.error || 'Failed to invite client')
        return
      }
      router.refresh()
      toast.success('Client invited')
      return
    }
    setInvitingClient(client)
    setInviteEmail('')
    setInviteDialogOpen(true)
  }

  async function handleInviteWithEmail() {
    if (!invitingClient) return
    setInviting(true)
    const result = await inviteClient({ clientId: invitingClient.id, email: inviteEmail })
    setInviting(false)
    if (!result.success) {
      toast.error(result.error || 'Failed to invite client')
      return
    }
    setInviteDialogOpen(false)
    setInvitingClient(undefined)
    router.refresh()
    toast.success('Client invited')
  }

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">No clients yet</p>
        <div className="flex gap-2">
          <Button onClick={openNew} aria-label="New client">
            <Plus />
            New Client
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
    <div className="flex flex-col p-6 gap-4 flex-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <div className="flex gap-2">
          <Button onClick={openNew} aria-label="New client">
            <Plus />
            New Client
          </Button>
          <ImportButton onSuccess={() => router.refresh()} />
        </div>
      </div>

      <div className="rounded-md border overflow-auto max-h-[calc(100vh-10rem)]" role="region" aria-label="Clients table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Phone</TableHead>
              <TableHead scope="col">Location</TableHead>
              <TableHead scope="col">Comments</TableHead>
              <TableHead scope="col">Email</TableHead>
              <TableHead scope="col">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="select-none" onDoubleClick={() => openEdit(client)}>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.phone}</TableCell>
                <TableCell>{client.location ?? '—'}</TableCell>
                <TableCell>{client.comments ?? '—'}</TableCell>
                <TableCell>{client.email ?? '—'}</TableCell>
                <TableCell>
                  <ClientActionMenu
                    entityName={client.name}
                    onEdit={() => openEdit(client)}
                    onDelete={async () => {
                      const result = await deleteClient(client.id)
                      if (!result.success) toast.error(result.error || 'Failed to delete client')
                      else toast.success('Client deleted')
                    }}
                    canDelete={permissions.includes('clients:delete')}
                    onView={() => toast.info('View: ' + client.name)}
                    onInvite={() => handleInvite(client)}
                    canInvite={permissions.includes('clients:invite')}
                  />
                </TableCell>
              </TableRow>
            ))}
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
