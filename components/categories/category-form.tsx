'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useAction } from 'next-safe-action/hooks'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import { createCategory, updateCategory, checkSlugExists } from '@/lib/actions/categories'
import { useActionError } from '@/lib/util/action-errors'
import { unwrap } from '@/lib/util/unwrap'
import type { Category } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface CategoryFormProps {
  category?: Category
  taxonomyId: string
  onSuccess: () => void
  onCancel: () => void
}

export function CategoryForm({ category, taxonomyId, onSuccess, onCancel }: CategoryFormProps) {
  const t = useTranslations()
  const translateError = useActionError()
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [slugExists, setSlugExists] = useState(false)
  const slugTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isEditing = !!category

  const { execute: executeCreate, isExecuting: isCreating } = useAction(createCategory, {
    onSuccess: () => {
      toast.success(t('categories.categoryCreated'))
      onSuccess()
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(translateError(error.serverError.code))
      }
    },
  })

  const { execute: executeUpdate, isExecuting: isUpdating } = useAction(updateCategory, {
    onSuccess: () => {
      toast.success(t('categories.categoryUpdated'))
      onSuccess()
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(translateError(error.serverError.code))
      }
    },
  })

  const saving = isCreating || isUpdating

  const debouncedSlugCheck = useCallback((value: string) => {
    if (slugTimer.current) clearTimeout(slugTimer.current)
    if (!value || value === category?.slug) {
      setSlugExists(false)
      return
    }
    slugTimer.current = setTimeout(async () => {
      const result = await checkSlugExists({ taxonomyId, slug: value, excludeId: category?.id })
      setSlugExists(unwrap(result, { exists: false }).exists)
    }, 500)
  }, [taxonomyId, category?.id, category?.slug])

  useEffect(() => {
    return () => {
      if (slugTimer.current) clearTimeout(slugTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!name.trim()) fieldErrors.name = t('categories.nameRequired')
    if (!slug.trim()) fieldErrors.slug = t('categories.slugRequired')
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (slugExists) {
      setErrors((prev) => ({ ...prev, slug: t('categories.slugInUse') }))
      return
    }

    const data = { name: name.trim(), slug: slug.trim(), description: description.trim() }

    if (isEditing) {
      executeUpdate({ ...data, id: category!.id })
    } else {
      executeCreate({ ...data, taxonomyId })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        name="name"
        label={t('categories.name')}
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <Field
        name="slug"
        label={t('categories.slug')}
        value={slug}
        onChange={(v) => { setSlug(v); debouncedSlugCheck(v) }}
        error={errors.slug}
        extraError={slugExists ? t('categories.slugInUse') : undefined}
      />
      <Field
        name="description"
        label={t('categories.description')}
        value={description}
        onChange={setDescription}
        error={errors.description}
        type="textarea"
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {isEditing ? t('common.saveChanges') : t('categories.createCategory')}
        </Button>
      </div>
    </form>
  )
}
