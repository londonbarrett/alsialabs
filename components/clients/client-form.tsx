"use client"

import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useLoadingIndicator } from "@/hooks/use-loading-indicator"
import {
  checkPhoneExists,
  createClient,
  updateClient,
} from "@/lib/actions/clients"
import type { Client } from "@/lib/drizzle/schema"
import { useActionError } from "@/lib/util/action-errors"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

interface ClientFormProps {
  client?: Client
  onSuccess: (data: Omit<Client, "id" | "userId" | "store_id">) => void
  onCancel: () => void
}

export function ClientForm({
  client,
  onSuccess,
  onCancel,
}: ClientFormProps) {
  const t = useTranslations()
  const [name, setName] = useState(client?.name ?? "")
  const [phone, setPhone] = useState(client?.phone ?? "")
  const [location, setLocation] = useState(client?.location ?? "")
  const [comments, setComments] = useState(client?.comments ?? "")
  const [email, setEmail] = useState(client?.email ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [phoneExists, setPhoneExists] = useState(false)
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const [, startTransition] = useTransition()
  const { start: startLoading, stop: stopLoading } =
    useLoadingIndicator()
  const translateError = useActionError()
  const { executeAsync: executeCreate } = useAction(createClient)
  const { executeAsync: executeUpdate } = useAction(updateClient)

  const debouncedPhoneCheck = useCallback(
    (value: string) => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current)
      if (!value || value === client?.phone) {
        setPhoneExists(false)
        return
      }
      phoneTimer.current = setTimeout(async () => {
        const result = await checkPhoneExists({
          phone: value,
          excludeId: client?.id,
        })
        setPhoneExists(result.data?.exists ?? false)
      }, 500)
    },
    [client?.id, client?.phone]
  )

  useEffect(() => {
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("clients.nameRequired")
    if (!phone.trim()) fieldErrors.phone = t("clients.phoneRequired")
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = t("clients.invalidEmail")
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (phoneExists) {
      setErrors((prev) => ({ ...prev, phone: t("clients.phoneInUse") }))
      return
    }

    const data = {
      name: name.trim(),
      phone: phone.trim(),
      location: location.trim(),
      comments: comments.trim(),
      email: email.trim(),
    }

    setSaving(true)
    onSuccess(data)

    startLoading()
    startTransition(async () => {
      const result = client?.id
        ? await executeUpdate({ ...data, id: client.id })
        : await executeCreate(data)
      if (result.data) {
        toast.success(
          client
            ? t("clients.clientUpdated")
            : t("clients.clientCreated")
        )
      } else {
        if (result.validationErrors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(
            result.validationErrors as Record<string, string[]>
          )) {
            if (msgs && msgs.length > 0) mapped[key] = msgs[0]
          }
          setErrors(mapped)
        }
        if (result.serverError) {
          toast.error(translateError(result.serverError.code))
        } else if (!result.validationErrors) {
          toast.error(t("common.somethingWentWrong"))
        }
      }
      setSaving(false)
      stopLoading()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t("common.name")}
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <Field
        name="phone"
        label={t("common.phone")}
        value={phone}
        onChange={(v) => {
          setPhone(v)
          debouncedPhoneCheck(v)
        }}
        error={errors.phone}
        extraError={phoneExists ? t("clients.phoneInUse") : undefined}
      />
      <Field
        name="location"
        label={t("clients.location")}
        value={location}
        onChange={setLocation}
        error={errors.location}
      />
      <Field
        name="comments"
        label={t("clients.comments")}
        value={comments}
        onChange={setComments}
        error={errors.comments}
        type="textarea"
      />
      <Field
        name="email"
        label={t("common.email")}
        value={email}
        onChange={setEmail}
        error={errors.email}
        type="email"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {client ? t("common.saveChanges") : t("clients.createClient")}
        </Button>
      </div>
    </form>
  )
}
