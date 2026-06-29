'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((v) => v.trim()),
  phone: z.string().min(1, 'Phone is required').transform((v) => v.trim()),
  location: z.string().transform((v) => v.trim()).optional().default(''),
  comments: z.string().transform((v) => v.trim()).optional().default(''),
  email: z.string().email('Invalid email').transform((v) => v.trim()).optional().default(''),
})

const phoneSchema = z.string().min(1, 'Phone is required').transform((v) => v.trim())
const idSchema = z.string().uuid()

export type ClientFormData = z.infer<typeof clientSchema>

export async function getClients() {
  try {
    await requirePermission('clients', 'view')
  } catch {
    throw new Error('Forbidden')
  }

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
    })
    .from(clientsTable)
}

export async function checkPhoneExists(phone: string, excludeId?: string) {
  const phoneResult = phoneSchema.safeParse(phone)
  if (!phoneResult.success) return { exists: false }

  try {
    await requirePermission('clients', 'view')
  } catch {
    return { exists: false }
  }
  const excludeIdParsed = excludeId ? idSchema.safeParse(excludeId) : null
  if (excludeIdParsed && !excludeIdParsed.success) return { exists: false }

  const existing = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))

  if (existing.length === 0) return { exists: false }
  if (excludeIdParsed) return { exists: existing[0].id !== excludeIdParsed.data }
  return { exists: true }
}

export async function upsertClient(data: ClientFormData, clientId?: string) {
  try {
    await requirePermission('clients', clientId ? 'edit' : 'create')
  } catch {
    return { success: false, error: 'Forbidden' }
  }

  const parsed = clientSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const fields = parsed.data

  const clientIdParsed = clientId ? idSchema.safeParse(clientId) : null
  if (clientIdParsed && !clientIdParsed.success) {
    return { success: false, error: 'Invalid client ID' }
  }

  const phoneCheck = await checkPhoneExists(fields.phone, clientIdParsed?.data)
  if (phoneCheck.exists) {
    return { success: false, error: 'A client with this phone number already exists', fieldErrors: { phone: ['Phone number already in use'] } }
  }

  const sanitized = {
    name: fields.name,
    phone: fields.phone,
    location: fields.location || null,
    comments: fields.comments || null,
    email: fields.email || null,
  }

  if (clientIdParsed) {
    await db.update(clientsTable).set(sanitized).where(eq(clientsTable.id, clientIdParsed.data))
  } else {
    await db.insert(clientsTable).values(sanitized)
  }

  revalidatePath('/dashboard/clients')
  return { success: true }
}

export async function deleteClient(clientId: string) {
  try {
    await requirePermission('clients', 'delete')
  } catch {
    return { success: false as const, error: 'Forbidden' }
  }

  const idParsed = idSchema.safeParse(clientId)
  if (!idParsed.success) return { success: false as const, error: 'Invalid client ID' }

  await db.delete(clientsTable).where(eq(clientsTable.id, idParsed.data))
  revalidatePath('/dashboard/clients')
  return { success: true as const }
}
