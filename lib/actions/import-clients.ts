'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { z } from 'zod'
import { getActionT } from '@/lib/i18n-actions'
import Papa from 'papaparse'

const REQUIRED_COLUMNS = ['NAME', 'PHONE', 'LOCATION', 'COMMENTS', 'EMAIL']

const csvRecordSchema = z.object({
  name: z.string().min(1).max(500).transform((v) => v.trim()),
  phone: z.string().min(1).max(100).transform((v) => v.trim()),
  location: z.string().max(1000).transform((v) => v.trim()).optional().default(''),
  comments: z.string().max(5000).transform((v) => v.trim()).optional().default(''),
  email: z.string().max(500).transform((v) => v.trim()).optional().default(''),
})

export async function importClients(formData: FormData) {
  const t = await getActionT('actions.import')
  const session = await auth()
  if (!session?.user) return { success: false, error: t('unauthorized') }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: t('noFileProvided') }

  const text = await file.text()

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toUpperCase(),
  })

  if (parsed.errors.length > 0) {
    return { success: false, error: parsed.errors[0].message }
  }

  if (parsed.data.length === 0) {
    return { success: false, error: t('csvEmpty') }
  }

  const headers = Object.keys(parsed.data[0])
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
  if (missing.length > 0) {
    return { success: false, error: t('missingRequiredColumns', { columns: missing.join(', ') }) }
  }

  const phones = [...new Set(parsed.data.map((r) => r.PHONE).filter(Boolean))]
  if (phones.length === 0) {
    return { success: false, error: t('noValidRows') }
  }

  const existing = await db
    .select({ phone: clientsTable.phone })
    .from(clientsTable)
    .where(inArray(clientsTable.phone, phones))

  const existingPhones = new Set(existing.map((r) => r.phone))

  const toInsert: Array<{ name: string; phone: string; location: string | null; comments: string | null; email: string | null }> = []
  for (const row of parsed.data) {
    if (!row.PHONE || existingPhones.has(row.PHONE)) continue
    const result = csvRecordSchema.safeParse({
      name: row.NAME,
      phone: row.PHONE,
      location: row.LOCATION,
      comments: row.COMMENTS,
      email: row.EMAIL,
    })
    if (!result.success) continue
    toInsert.push({
      name: result.data.name,
      phone: result.data.phone,
      location: result.data.location || null,
      comments: result.data.comments || null,
      email: result.data.email || null,
    })
  }

  if (toInsert.length === 0) return { success: true, importedCount: 0 }

  await db.insert(clientsTable).values(toInsert)

  revalidatePath('/dashboard/clients')
  return { success: true, importedCount: toInsert.length }
}
