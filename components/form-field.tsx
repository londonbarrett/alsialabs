'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MoneyInput } from '@/components/common/money-input'

export interface FieldProps {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  extraError?: string
  type?: string
  currency?: string
  locale?: string
}

export function Field({ name, label, value, onChange, error, extraError, type = 'text', currency, locale }: FieldProps) {
  const errorMsg = extraError || error
  const describedBy = errorMsg ? `${name}-error` : undefined

  return (
    <div className="flex flex-col gap-2" data-invalid={!!errorMsg || undefined}>
      <Label htmlFor={name}>{label}</Label>
      {type === 'textarea' ? (
        <Textarea id={name} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!errorMsg} aria-describedby={describedBy} />
      ) : type === 'money' ? (
        <MoneyInput id={name} value={value} onChange={onChange} currency={currency} locale={locale} aria-invalid={!!errorMsg} aria-describedby={describedBy} />
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
