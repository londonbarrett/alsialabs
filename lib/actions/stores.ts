'use server'

import { db } from '@/lib/drizzle/client'
import { storesTable } from '@/lib/drizzle/schema'
import { requirePermission } from '@/lib/auth'
import { getActionT } from '@/lib/i18n-actions'

export async function getStores() {
  const t = await getActionT('actions.stores')
  try {
    await requirePermission('products', 'view')
  } catch {
    throw new Error(t('forbidden'))
  }
  return db
    .select({
      id: storesTable.id,
      name: storesTable.name,
    })
    .from(storesTable)
}

export type StoreOption = Awaited<ReturnType<typeof getStores>>[number]
