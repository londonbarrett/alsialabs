"use client"

import { Field } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  createProduct,
  updateProduct,
  checkSkuExists,
} from "@/lib/actions/products"
import { useActionError } from "@/lib/util/action-errors"
import { unwrapResponse } from "@/lib/util/unwrap"
import type { Product } from "@/lib/drizzle/schema"
import { useAction } from "next-safe-action/hooks"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface StoreOption {
  id: string
  name: string
}

interface ProductFormProps {
  product?: Product
  stores: StoreOption[]
  onSuccess: () => void
  onCancel: () => void
}

export function ProductForm({
  product,
  stores,
  onSuccess,
  onCancel,
}: ProductFormProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(
    product?.description ?? ""
  )
  const [storeId, setStoreId] = useState(product?.store_id ?? "")
  const [sku, setSku] = useState(product?.sku ?? "")
  const [unit, setUnit] = useState(product?.unit ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [skuExists, setSkuExists] = useState(false)
  const skuTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const isEditing = !!product

  const { execute: executeCreate, isExecuting: isCreating } = useAction(
    createProduct,
    {
      onSuccess: () => {
        toast.success(t("products.productCreated"))
        onSuccess()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(translateError(error.serverError.code))
        }
      },
    }
  )

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(
    updateProduct,
    {
      onSuccess: () => {
        toast.success(t("products.productUpdated"))
        onSuccess()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(translateError(error.serverError.code))
        }
      },
    }
  )

  const saving = isCreating || isUpdating

  const debouncedSkuCheck = useCallback(
    (value: string) => {
      if (skuTimer.current) clearTimeout(skuTimer.current)
      if (!value || value === product?.sku) {
        setSkuExists(false)
        return
      }
      skuTimer.current = setTimeout(async () => {
        const result = await checkSkuExists({
          sku: value,
          excludeId: product?.id,
        })
        setSkuExists(unwrapResponse(result, { exists: false }).exists)
      }, 500)
    },
    [product?.id, product?.sku]
  )

  useEffect(() => {
    return () => {
      if (skuTimer.current) clearTimeout(skuTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t("products.nameRequired")
    if (!storeId) fieldErrors.store_id = t("products.storeRequired")
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (skuExists) {
      setErrors((prev) => ({ ...prev, sku: t("products.skuInUse") }))
      return
    }

    const data = {
      name: name.trim(),
      description: description.trim(),
      store_id: storeId,
      sku: sku.trim(),
      unit: unit.trim(),
    }

    if (isEditing) {
      executeUpdate({ ...data, id: product.id })
    } else {
      executeCreate(data)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t("products.name")}
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <div
        className="flex flex-col gap-2"
        data-invalid={!!errors.store_id || undefined}
      >
        <Label htmlFor="store_id">{t("products.store")}</Label>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger id="store_id" aria-invalid={!!errors.store_id}>
            <SelectValue placeholder={t("products.selectStore")} />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.store_id && (
          <p
            id="store_id-error"
            className="text-xs text-destructive"
            role="alert"
          >
            {errors.store_id}
          </p>
        )}
      </div>
      <Field
        name="sku"
        label={t("products.sku")}
        value={sku}
        onChange={(v) => {
          setSku(v)
          debouncedSkuCheck(v)
        }}
        error={errors.sku}
        extraError={skuExists ? t("products.skuInUse") : undefined}
      />
      <Field
        name="unit"
        label={t("products.unit")}
        value={unit}
        onChange={setUnit}
        error={errors.unit}
      />
      <Field
        name="description"
        label={t("products.description")}
        value={description}
        onChange={setDescription}
        error={errors.description}
        type="textarea"
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
          {isEditing
            ? t("common.saveChanges")
            : t("products.createProduct")}
        </Button>
      </div>
    </form>
  )
}
