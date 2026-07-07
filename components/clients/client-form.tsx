'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import { upsertClient, checkPhoneExists } from '@/lib/actions/clients'
import type { Client } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ClientFormProps {
  client?: Client
  onSuccess: () => void
  onCancel: () => void
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const t = useTranslations()
  const [name, setName] = useState(client?.name ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [location, setLocation] = useState(client?.location ?? '')
  const [comments, setComments] = useState(client?.comments ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [phoneExists, setPhoneExists] = useState(false)
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const debouncedPhoneCheck = useCallback((value: string) => {
    if (phoneTimer.current) clearTimeout(phoneTimer.current)
    if (!value || value === client?.phone) {
      setPhoneExists(false)
      return
    }
    phoneTimer.current = setTimeout(async () => {
      const result = await checkPhoneExists(value, client?.id)
      setPhoneExists(result.exists)
    }, 500)
  }, [client?.id, client?.phone])

  useEffect(() => {
    return () => {
      if (phoneTimer.current) clearTimeout(phoneTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t('clients.nameRequired')
    if (!phone.trim()) fieldErrors.phone = t('clients.phoneRequired')
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = t('clients.invalidEmail')
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (phoneExists) {
      setErrors((prev) => ({ ...prev, phone: t('clients.phoneInUse') }))
      return
    }

    setSaving(true)
    try {
      const result = await upsertClient(
        { name: name.trim(), phone: phone.trim(), location: location.trim(), comments: comments.trim(), email: email.trim() },
        client?.id,
      )
      if (result.success) {
        toast.success(client ? t('clients.clientUpdated') : t('clients.clientCreated'))
        onSuccess()
      } else {
        if (result.fieldErrors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(result.fieldErrors)) {
            if (msgs && msgs.length > 0) mapped[key] = msgs[0]
          }
          setErrors(mapped)
        }
        toast.error(result.error || t('common.somethingWentWrong'))
      }
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field name="name" label={t('common.name')} value={name} onChange={setName} error={errors.name} />
      <Field name="phone" label={t('common.phone')} value={phone} onChange={(v) => { setPhone(v); debouncedPhoneCheck(v) }} error={errors.phone} extraError={phoneExists ? t('clients.phoneInUse') : undefined} />
      <Field name="location" label={t('clients.location')} value={location} onChange={setLocation} error={errors.location} />
      <Field name="comments" label={t('clients.comments')} value={comments} onChange={setComments} error={errors.comments} type="textarea" />
      <Field name="email" label={t('common.email')} value={email} onChange={setEmail} error={errors.email} type="email" />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {client ? t('common.saveChanges') : t('clients.createClient')}
        </Button>
      </div>
    </form>
  )
}

