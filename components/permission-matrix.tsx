"use client"

import { useState, Fragment } from "react"
import { useTranslations } from "next-intl"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Trash2 } from "lucide-react"
import {
  manageModule,
  togglePermission,
} from "@/actions/not-safe/permissions"
import { DestructiveDialog } from "@/components/common/destructive-dialog"
import { toast } from "sonner"
import { useActionError } from "@/lib/util/action-errors"
import { defaultIsSuccess } from "@/lib/util/action-result"
import type { PermissionMatrixItemDTO } from "@/actions/schemas/permission"

type Role = { id: string; name: string }

type Props = {
  matrix: PermissionMatrixItemDTO[]
  roles: Role[]
}

export function PermissionMatrix({ matrix, roles }: Props) {
  const t = useTranslations()
  const translateError = useActionError()
  const [addOpen, setAddOpen] = useState(false)
  const [moduleName, setModuleName] = useState("")
  const [actionsStr, setActionsStr] = useState("")
  const [deleteModule, setDeleteModule] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const modules = new Map<string, PermissionMatrixItemDTO[]>()
  for (const item of matrix) {
    const existing = modules.get(item.module) ?? []
    existing.push(item)
    modules.set(item.module, existing)
  }

  async function handleAddModule() {
    const actions = actionsStr
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
    const result = await manageModule({
      action: "create",
      name: moduleName,
      actions,
    })
    if (!defaultIsSuccess(result)) {
      toast.error(
        result.serverError
          ? translateError(result.serverError.code)
          : t("permissions.failedToCreate")
      )
    } else {
      toast.success(t("permissions.moduleCreated"))
      setAddOpen(false)
      setModuleName("")
      setActionsStr("")
    }
  }

  async function handleDeleteModule(name: string) {
    setDeleteModule(name)
  }

  async function confirmDeleteModule() {
    if (!deleteModule) return
    setDeleting(true)
    const result = await manageModule({
      action: "delete",
      name: deleteModule,
    })
    if (!defaultIsSuccess(result)) {
      toast.error(
        result.serverError
          ? translateError(result.serverError.code)
          : t("permissions.failedToDelete")
      )
    } else {
      toast.success(t("permissions.moduleDeleted"))
    }
    setDeleteModule(null)
    setDeleting(false)
  }

  async function handleToggle(
    permissionId: string,
    roleId: string,
    currentEnabled: boolean
  ) {
    const result = await togglePermission({
      roleId,
      permissionId,
      enabled: !currentEnabled,
    })
    if (!defaultIsSuccess(result)) {
      toast.error(
        result.serverError
          ? translateError(result.serverError.code)
          : t("permissions.failedToToggle")
      )
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("nav.permisos")}
        </h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus />
                {t("common.addModule")}
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("common.addModule")}</DialogTitle>
              <DialogDescription>
                {t("permissions.addModuleDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="module-name">
                  {t("permissions.moduleName")}
                </Label>
                <Input
                  id="module-name"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder={t("permissions.modulePlaceholder")}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="module-actions">
                  {t("common.actions")}
                </Label>
                <Input
                  id="module-actions"
                  value={actionsStr}
                  onChange={(e) => setActionsStr(e.target.value)}
                  placeholder={t("permissions.actionsPlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAddModule}>
                {t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">
                {t("permissions.moduleActions")}
              </TableHead>
              {roles.map((role) => (
                <TableHead
                  key={role.id}
                  className="text-center capitalize"
                >
                  {role.name}
                </TableHead>
              ))}
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(modules.entries()).map(
              ([moduleName, items]) => (
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
                        aria-label={t("permissions.deleteModule", {
                          name: moduleName,
                        })}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-8 text-muted-foreground">
                        {item.action}
                      </TableCell>
                      {roles.map((role) => {
                        const enabled = item.roleIds.includes(role.id)
                        return (
                          <TableCell
                            key={role.id}
                            className="text-center"
                          >
                            <Switch
                              checked={enabled}
                              onCheckedChange={() =>
                                handleToggle(item.id, role.id, enabled)
                              }
                              aria-label={t(
                                "permissions.togglePermission",
                                {
                                  module: moduleName,
                                  action: item.action,
                                  role: role.name,
                                }
                              )}
                            />
                          </TableCell>
                        )
                      })}
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              )
            )}
          </TableBody>
        </Table>
      </div>

      <DestructiveDialog
        open={!!deleteModule}
        title={t("permissions.deleteModuleTitle")}
        message={t("permissions.deleteModuleConfirm", {
          name: deleteModule ?? "",
        })}
        onConfirm={confirmDeleteModule}
        onCancel={() => setDeleteModule(null)}
        loading={deleting}
      />
    </div>
  )
}
