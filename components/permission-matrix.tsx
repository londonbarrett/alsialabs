'use client'

import { useState, Fragment } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2 } from 'lucide-react'
import { manageModule, togglePermission } from '@/lib/actions/permissions'
import { toast } from 'sonner'
import type { PermissionMatrixItem } from '@/lib/actions/permissions'

type Role = { id: string; name: string }

type Props = {
  matrix: PermissionMatrixItem[]
  roles: Role[]
}

export function PermissionMatrix({ matrix, roles }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [moduleName, setModuleName] = useState('')
  const [actionsStr, setActionsStr] = useState('')

  const modules = new Map<string, PermissionMatrixItem[]>()
  for (const item of matrix) {
    const existing = modules.get(item.module) ?? []
    existing.push(item)
    modules.set(item.module, existing)
  }

  async function handleAddModule() {
    const actions = actionsStr
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    const result = await manageModule({ action: 'create', name: moduleName, actions })
    if (!result.success) {
      toast.error(result.error || 'Failed to create module')
    } else {
      toast.success('Module created')
      setAddOpen(false)
      setModuleName('')
      setActionsStr('')
    }
  }

  async function handleDeleteModule(name: string) {
    const result = await manageModule({ action: 'delete', name })
    if (!result.success) {
      toast.error(result.error || 'Failed to delete module')
    } else {
      toast.success('Module deleted')
    }
  }

  async function handleToggle(permissionId: string, roleId: string, currentEnabled: boolean) {
    const result = await togglePermission({ roleId, permissionId, enabled: !currentEnabled })
    if (!result.success) {
      toast.error(result.error || 'Failed to toggle permission')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Module</DialogTitle>
              <DialogDescription>
                Create a new module with comma-separated actions (e.g., &quot;view, create, edit, delete&quot;).
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="module-name">Module Name</Label>
                <Input id="module-name" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="e.g., invoices" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="module-actions">Actions</Label>
                <Input id="module-actions" value={actionsStr} onChange={(e) => setActionsStr(e.target.value)} placeholder="view, create, edit, delete" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAddModule}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Module / Action</TableHead>
              {roles.map((role) => (
                <TableHead key={role.id} className="text-center capitalize">{role.name}</TableHead>
              ))}
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(modules.entries()).map(([moduleName, items]) => (
              <Fragment key={moduleName}>
                <TableRow className="bg-muted/30">
                  <TableCell
                    className="font-semibold capitalize"
                    colSpan={1 + roles.length}
                  >
                    {moduleName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteModule(moduleName)}
                      aria-label={`Delete ${moduleName} module`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-8 text-muted-foreground">{item.action}</TableCell>
                    {roles.map((role) => {
                      const enabled = item.roleIds.includes(role.id)
                      return (
                        <TableCell key={role.id} className="text-center">
                          <Switch
                            checked={enabled}
                            onCheckedChange={() => handleToggle(item.id, role.id, enabled)}
                            aria-label={`${moduleName} ${item.action} for ${role.name}`}
                          />
                        </TableCell>
                      )
                    })}
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
