'use client'

import { useState } from 'react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Pen, Trash2, Plus } from 'lucide-react'
import { createUser, updateUser, deleteUser } from '@/lib/actions/users'
import type { UserWithRole } from '@/lib/actions/users'
import { toast } from 'sonner'

type Role = { id: string; name: string }

type Props = {
  users: UserWithRole[]
  roles: Role[]
  currentUserId: string
}

export function UsersTable({ users, roles }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null)
  const [deletingUser, setDeletingUser] = useState<UserWithRole | null>(null)

  const handleCreate = async (formData: FormData) => {
    const result = await createUser({
      email: formData.get('email') as string,
      roleId: formData.get('roleId') as string,
    })
    if (!result.success) {
      toast.error(result.error || 'Failed to create user')
    } else {
      toast.success('User created')
      setIsCreateOpen(false)
    }
  }

  const handleUpdate = async (formData: FormData) => {
    if (!editingUser) return
    const result = await updateUser(editingUser.id, {
      email: formData.get('email') as string,
      roleId: formData.get('roleId') as string,
    })
    if (!result.success) {
      toast.error(result.error || 'Failed to update user')
    } else {
      toast.success('User updated')
      setEditingUser(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    const result = await deleteUser(deletingUser.id)
    if (!result.success) {
      toast.error(result.error || 'Failed to delete user')
    } else {
      toast.success('User deleted')
      setDeletingUser(null)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus data-icon="inline-start" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Add a new user. They will receive an invitation email.
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreate}>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input id="create-email" name="email" type="email" required />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="create-role">Role</Label>
                  <Select name="roleId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name ?? '—'}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.roleName}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Dialog
                    open={editingUser?.id === user.id}
                    onOpenChange={(open) => {
                      if (!open) setEditingUser(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingUser(user)}
                      >
                        <Pen className="size-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                          Update user details and role.
                        </DialogDescription>
                      </DialogHeader>
                      <form action={handleUpdate}>
                        <div className="flex flex-col gap-4 py-4">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                              id="edit-email"
                              name="email"
                              type="email"
                              defaultValue={user.email ?? ''}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-role">Role</Label>
                            <Select
                              name="roleId"
                              defaultValue={user.roleId}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit">Save</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
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

      <Dialog
        open={!!deletingUser}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingUser?.email}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
