'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { upsertClient, checkPhoneExists } from '@/lib/actions/clients'
import type { Client } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ClientFormProps {
  client?: Client
  onSuccess: () => void
  onCancel: () => void
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
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
    if (!name.trim()) fieldErrors.name = 'Name is required'
    if (!phone.trim()) fieldErrors.phone = 'Phone is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldErrors.email = 'Invalid email address'
    }
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (phoneExists) {
      setErrors((prev) => ({ ...prev, phone: 'This phone number is already in use' }))
      return
    }

    setSaving(true)
    try {
      const result = await upsertClient(
        { name: name.trim(), phone: phone.trim(), location: location.trim(), comments: comments.trim(), email: email.trim() },
        client?.id,
      )
      if (result.success) {
        toast.success(client ? 'Client updated' : 'Client created')
        onSuccess()
      } else {
        if (result.fieldErrors) {
          const mapped: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(result.fieldErrors)) {
            if (msgs && msgs.length > 0) mapped[key] = msgs[0]
          }
          setErrors(mapped)
        }
        toast.error(result.error || 'Something went wrong')
      }
    } catch {
      toast.error('Something went wrong')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field name="name" label="Name" value={name} onChange={setName} error={errors.name} />
      <Field name="phone" label="Phone" value={phone} onChange={(v) => { setPhone(v); debouncedPhoneCheck(v) }} error={errors.phone} extraError={phoneExists ? 'This phone number is already in use' : undefined} />
      <Field name="location" label="Location" value={location} onChange={setLocation} error={errors.location} />
      <Field name="comments" label="Comments" value={comments} onChange={setComments} error={errors.comments} type="textarea" />
      <Field name="email" label="Email" value={email} onChange={setEmail} error={errors.email} type="email" />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {client ? 'Save Changes' : 'Create Client'}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  extraError?: string
  type?: string
}

function Field({ name, label, value, onChange, error, extraError, type = 'text' }: FieldProps) {
  const errorMsg = extraError || error
  const describedBy = errorMsg ? `${name}-error` : undefined

  return (
    <div className="flex flex-col gap-2" data-invalid={!!errorMsg || undefined}>
      <Label htmlFor={name}>{label}</Label>
      {type === 'textarea' ? (
        <Textarea id={name} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!errorMsg} aria-describedby={describedBy} />
      ) : (
        <Input id={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!errorMsg} aria-describedby={describedBy} />
      )}
      {errorMsg && (
        <p id={`${name}-error`} className="text-xs text-destructive" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
