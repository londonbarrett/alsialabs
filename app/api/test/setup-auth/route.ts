import { NextResponse } from 'next/server'
import { db } from '@/lib/drizzle/client'
import { usersTable, sessionsTable } from '@/lib/drizzle/schema'
import crypto from 'crypto'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const sessionToken = 'test-session-' + crypto.randomUUID()
  const userId = 'test-user-' + crypto.randomUUID()

  await db.insert(usersTable).values({
    id: userId,
    name: 'Test User',
    email: userId + '@test.com',
  })

  await db.insert(sessionsTable).values({
    sessionToken,
    userId,
    expires: new Date(Date.now() + 86400000),
  })

  return NextResponse.json({ sessionToken, userId })
}
