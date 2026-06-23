'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { clientsTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').transform((v) => v.trim()),
  phone: z.string().min(1, 'Phone is required').transform((v) => v.trim()),
  location: z.string().transform((v) => v.trim()).optional().default(''),
  comments: z.string().transform((v) => v.trim()).optional().default(''),
  email: z.string().email('Invalid email').transform((v) => v.trim()).optional().default(''),
})

export type ClientFormData = z.infer<typeof clientSchema>

export async function checkPhoneExists(phone: string, excludeId?: string) {
  const existing = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
  return { exists: true }
}

export async function upsertClient(data: ClientFormData, clientId?: string) {
  const session = await auth()
  if (!session?.user) return { success: false, error: 'Unauthorized' }

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
