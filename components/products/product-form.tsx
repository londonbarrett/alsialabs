'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { upsertProduct, checkSkuExists } from '@/lib/actions/products'
import type { Product } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ProviderOption {
  id: string
  name: string
}

interface ProductFormProps {
  product?: Product
  providers: ProviderOption[]
  onSuccess: () => void
  onCancel: () => void
}

export function ProductForm({ product, providers, onSuccess, onCancel }: ProductFormProps) {
  const t = useTranslations()
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [providerId, setProviderId] = useState(product?.provider_id ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [unit, setUnit] = useState(product?.unit ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [skuExists, setSkuExists] = useState(false)
  const skuTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const debouncedSkuCheck = useCallback((value: string) => {
    if (skuTimer.current) clearTimeout(skuTimer.current)
    if (!value || value === product?.sku) {
      setSkuExists(false)
      return
    }
    skuTimer.current = setTimeout(async () => {
      const result = await checkSkuExists(value, product?.id)
      setSkuExists(result.exists)
    }, 500)
  }, [product?.id, product?.sku])

  useEffect(() => {
    return () => {
      if (skuTimer.current) clearTimeout(skuTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t('products.nameRequired')
    if (!providerId) fieldErrors.provider_id = t('products.providerRequired')
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (skuExists) {
      setErrors((prev) => ({ ...prev, sku: t('products.skuInUse') }))
      return
    }

    setSaving(true)
    try {
      const result = await upsertProduct(
        { name: name.trim(), description: description.trim(), provider_id: providerId, sku: sku.trim(), unit: unit.trim() },
        product?.id,
      )
      if (result.success) {
        toast.success(product ? t('products.productUpdated') : t('products.productCreated'))
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
      <Field name="name" label={t('products.name')} value={name} onChange={setName} error={errors.name} />
      <div className="flex flex-col gap-2" data-invalid={!!errors.provider_id || undefined}>
        <Label htmlFor="provider_id">{t('products.provider')}</Label>
        <Select value={providerId} onValueChange={setProviderId}>
          <SelectTrigger id="provider_id" aria-invalid={!!errors.provider_id}>
            <SelectValue placeholder={t('products.selectProvider')} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.provider_id && (
          <p id="provider_id-error" className="text-xs text-destructive" role="alert">
            {errors.provider_id}
          </p>
        )}
      </div>
      <Field name="sku" label={t('products.sku')} value={sku} onChange={(v) => { setSku(v); debouncedSkuCheck(v) }} error={errors.sku} extraError={skuExists ? t('products.skuInUse') : undefined} />
      <Field name="unit" label={t('products.unit')} value={unit} onChange={setUnit} error={errors.unit} />
      <Field name="description" label={t('products.description')} value={description} onChange={setDescription} error={errors.description} type="textarea" />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {product ? t('common.saveChanges') : t('products.createProduct')}
        </Button>
      </div>
    </form>
  )
}

