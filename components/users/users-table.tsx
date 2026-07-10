"use client"

import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserDialog } from "@/components/users/user-dialog"
import type { UserWithRole } from "@/lib/actions/users"
import { deleteUser } from "@/lib/actions/users"
import { Pen, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type Role = { id: string; name: string }

type Props = {
  users: UserWithRole[]
  roles: Role[]
  currentUserId: string
}

export function UsersTable({ users, roles }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(
    null
  )
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(
    null
  )
  const [deleting, setDeleting] = useState(false)

  const dialogOpen = isCreateOpen || !!editingUser

  function handleSuccess() {
    router.refresh()
    setIsCreateOpen(false)
    setEditingUser(null)
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setDeleting(true)
    const result = await deleteUser(deletingUser.id)
    if (!result.success) {
      toast.error(result.error || t("users.failedToDelete"))
    } else {
      toast.success(t("users.userDeleted"))
      setDeletingUser(null)
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("users.title")}
        </h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          {t("users.addUser")}
        </Button>
      </div>

      <UserDialog
        key={isCreateOpen ? "create" : (editingUser?.id ?? "create")}
        user={editingUser}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setEditingUser(null)
          }
        }}
        roles={roles}
        onSuccess={handleSuccess}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("users.name")}</TableHead>
            <TableHead>{t("users.email")}</TableHead>
            <TableHead>{t("users.role")}</TableHead>
            <TableHead className="w-24">{t("users.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name ?? "—"}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.roleName}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingUser(user)}
                  >
                    <Pen className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingUser(user)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DestructiveDialog
        open={!!deletingUser}
        title={t("users.deleteUser")}
        message={t("users.deleteDescription", {
          email: deletingUser?.email ?? "",
        })}
        onConfirm={handleDelete}
        onCancel={() => setDeletingUser(null)}
        loading={deleting}
      />
    </div>
  )
}
