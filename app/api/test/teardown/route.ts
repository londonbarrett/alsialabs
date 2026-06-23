import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/drizzle/client'
import { sessionsTable, usersTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { sessionToken, userId } = await req.json()

  await db.delete(sessionsTable).where(eq(sessionsTable.sessionToken, sessionToken))
  await db.delete(usersTable).where(eq(usersTable.id, userId))

  return NextResponse.json({ ok: true })
}
