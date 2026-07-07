'use server'

import { db } from '@/lib/drizzle/client'
import { providersTable } from '@/lib/drizzle/schema'
import { requirePermission } from '@/lib/auth'
import { getActionT } from '@/lib/i18n-actions'

export async function getProviders() {
  const t = await getActionT('actions.providers')
  try {
    await requirePermission('products', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }
  return db
    .select({
      id: providersTable.id,
      name: providersTable.name,
    })
    .from(providersTable)
}

export type ProviderOption = Awaited<ReturnType<typeof getProviders>>[number]
