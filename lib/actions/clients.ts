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

export type ClientFormData = z.infer<typeof clientSchema>

export async function checkPhoneExists(phone: string, excludeId?: string) {
  const phoneResult = phoneSchema.safeParse(phone)
  if (!phoneResult.success) return { exists: false }

  try {
    await requirePermission('clients', 'view')
  } catch {
    return { exists: false }
  }
  const existing = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
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

  const phoneCheck = await checkPhoneExists(fields.phone, clientId)
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

  if (clientId) {
    await db.update(clientsTable).set(sanitized).where(eq(clientsTable.id, clientId))
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

  await db.delete(clientsTable).where(eq(clientsTable.id, clientId))
  revalidatePath('/dashboard/clients')
  return { success: true as const }
}
