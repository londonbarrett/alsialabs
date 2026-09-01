import { ClientActionMenu } from "@/components/clients/client-action-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Client } from "@/lib/drizzle/schema"
import { useTranslations } from "next-intl"
import Link from "next/link"

interface ClientsTableProps {
  clients: Client[]
  permissions: string[]
  onEdit: (client: Client) => void
  onInvite: (client: Client) => Promise<void>
  onDelete: (client: Client) => Promise<void>
  onView: (client: Client) => void
}

export function ClientsTable({
  clients,
  permissions,
  onEdit,
  onInvite,
  onDelete,
  onView,
}: ClientsTableProps) {
  const t = useTranslations()

  return (
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
        {clients.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="h-24 text-center text-muted-foreground"
            >
              {t("clients.noResults")}
            </TableCell>
          </TableRow>
        ) : (
          clients.map((client) => (
            <TableRow
              key={client.id}
              className="select-none"
              onDoubleClick={() => onView(client)}
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
                  onEdit={() => onEdit(client)}
                  onDelete={() => onDelete(client)}
                  canDelete={permissions.includes("clients:delete")}
                  onView={() => onView(client)}
                  onInvite={() => onInvite(client)}
                  canInvite={permissions.includes("clients:invite")}
                />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
