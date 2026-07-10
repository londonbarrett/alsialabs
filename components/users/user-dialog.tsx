"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createUser, updateUser } from "@/lib/actions/users"
import { useTranslations } from "next-intl"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"

type Role = { id: string; name: string }

interface UserDialogProps {
  user?: { id: string; email: string | null; roleId: string } | null
  roles: Role[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {label}
    </Button>
  )
}

export function UserDialog({
  user,
  roles,
  open,
  onOpenChange,
  onSuccess,
}: UserDialogProps) {
  const t = useTranslations()
  const isEdit = !!user

  async function handleSubmit(formData: FormData) {
    if (isEdit && user) {
      const result = await updateUser(user.id, {
        email: formData.get("email") as string,
        roleId: formData.get("roleId") as string,
      })
      if (!result.success) {
        toast.error(result.error || t("users.failedToUpdate"))
        return
      }
      toast.success(t("users.userUpdated"))
    } else {
      const result = await createUser({
        email: formData.get("email") as string,
        roleId: formData.get("roleId") as string,
      })
      if (!result.success) {
        toast.error(result.error || t("users.failedToCreate"))
        return
      }
      toast.success(t("users.userCreated"))
    }
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("users.editUser") : t("users.createUser")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("users.editDescription")
              : t("users.createDescription")}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t("users.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">{t("users.role")}</Label>
              <Select
                name="roleId"
                defaultValue={user?.roleId ?? undefined}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectRole")} />
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
            <SubmitButton
              label={isEdit ? t("users.save") : t("users.create")}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
