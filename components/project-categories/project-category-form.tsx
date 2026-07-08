'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/form-field'
import { upsertProjectCategory, checkSlugExists } from '@/lib/actions/project-categories'
import type { ProjectCategory } from '@/lib/drizzle/schema'
import { toast } from 'sonner'

interface ProjectCategoryFormProps {
  category?: ProjectCategory
  onSuccess: () => void
  onCancel: () => void
}

export function ProjectCategoryForm({ category, onSuccess, onCancel }: ProjectCategoryFormProps) {
  const t = useTranslations()
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
      const result = await checkSlugExists(value, category?.id)
      setSlugExists(result.exists)
    }, 500)
  }, [category?.id, category?.slug])

  useEffect(() => {
    return () => {
      if (slugTimer.current) clearTimeout(slugTimer.current)
    }
  }, [])

  function validate() {
    const fieldErrors: Record<string, string> = {}
    if (!slug.trim()) fieldErrors.slug = t('project-categories.slugRequired')
    setErrors(fieldErrors)
    return Object.keys(fieldErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (slugExists) {
      setErrors((prev) => ({ ...prev, slug: t('project-categories.slugInUse') }))
      return
    }

    setSaving(true)
    try {
      const result = await upsertProjectCategory(
        { slug: slug.trim(), description: description.trim() },
        category?.id,
      )
      if (result.success) {
        toast.success(category ? t('project-categories.categoryUpdated') : t('project-categories.categoryCreated'))
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
      <p className="text-xs text-muted-foreground">{t('project-categories.slugHint')}</p>
      <Field
        name="slug"
        label={t('project-categories.slug')}
        value={slug}
        onChange={(v) => { setSlug(v); debouncedSlugCheck(v) }}
        error={errors.slug}
        extraError={slugExists ? t('project-categories.slugInUse') : undefined}
      />
      <Field
        name="description"
        label={t('project-categories.description')}
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
          {category ? t('common.saveChanges') : t('project-categories.createCategory')}
        </Button>
      </div>
    </form>
  )
}
