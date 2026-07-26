'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import { upsertCategory, checkSlugExists } from '@/lib/actions/categories'
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
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [slugExists, setSlugExists] = useState(false)
  const slugTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const debouncedSlugCheck = useCallback((value: string) => {
    if (slugTimer.current) clearTimeout(slugTimer.current)
    if (!value || value === category?.slug) {
      setSlugExists(false)
      return
    }
    slugTimer.current = setTimeout(async () => {
      const result = await checkSlugExists(taxonomyId, value, category?.id)
      setSlugExists(result.exists)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (slugExists) {
      setErrors((prev) => ({ ...prev, slug: t('categories.slugInUse') }))
      return
    }

    setSaving(true)
    try {
      const result = await upsertCategory(
        { name: name.trim(), slug: slug.trim(), description: description.trim() },
        taxonomyId,
        category?.id,
      )
      if (result.success) {
        toast.success(category ? t('categories.categoryUpdated') : t('categories.categoryCreated'))
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
          {category ? t('common.saveChanges') : t('categories.createCategory')}
        </Button>
      </div>
    </form>
  )
}
