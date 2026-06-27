'use server'

import { db } from '@/lib/drizzle/client'
import { providersTable } from '@/lib/drizzle/schema'
import { requirePermission } from '@/lib/auth'

export async function getProviders() {
  try {
    await requirePermission('products', 'view')
  } catch {
    throw new Error('Forbidden')
  }
  return db
    .select({
      id: providersTable.id,
      name: providersTable.name,
    })
    .from(providersTable)
}

export type ProviderOption = Awaited<ReturnType<typeof getProviders>>[number]
