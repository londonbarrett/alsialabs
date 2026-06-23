'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import Papa from 'papaparse'

const REQUIRED_COLUMNS = ['NAME', 'PHONE', 'LOCATION', 'COMMENTS', 'EMAIL']

export async function importClients(formData: FormData) {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided' }

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
    return { success: false, error: 'CSV file is empty or has no data rows' }
  }

  const headers = Object.keys(parsed.data[0])
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
  if (missing.length > 0) {
    return { success: false, error: `Missing required columns: ${missing.join(', ')}` }
  }

  const phones = [...new Set(parsed.data.map((r) => r.PHONE).filter(Boolean))]
  if (phones.length === 0) {
    return { success: false, error: 'No valid rows found in CSV' }
  }

  const existing = await db
    .select({ phone: clientsTable.phone })
    .from(clientsTable)
    .where(inArray(clientsTable.phone, phones))

  const existingPhones = new Set(existing.map((r) => r.phone))

  const toInsert = parsed.data
    .filter((row) => row.PHONE && !existingPhones.has(row.PHONE))
    .map((row) => ({
      name: row.NAME || 'Unknown',
      phone: row.PHONE,
      location: row.LOCATION || null,
      comments: row.COMMENTS || null,
      email: row.EMAIL || null,
    }))

  if (toInsert.length === 0) return { success: true, importedCount: 0 }

  await db.insert(clientsTable).values(toInsert)

  revalidatePath('/dashboard/clients')
  return { success: true, importedCount: toInsert.length }
}
