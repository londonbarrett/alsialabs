import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/drizzle/client'
import { usersTable, sessionsTable, userRolesTable, rolesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const roleParam = searchParams.get('role') ?? 'super'

  const sessionToken = 'test-session-' + crypto.randomUUID()
  const userId = 'test-user-' + crypto.randomUUID()

  await db.insert(usersTable).values({
    id: userId,
    name: 'Test User',
    email: userId + '@test.com',
  })

  const role = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, roleParam))
    .then((rows) => rows[0])

  if (role) {
    await db.insert(userRolesTable).values({
      userId,
      roleId: role.id,
    })
  }

  await db.insert(sessionsTable).values({
    sessionToken,
    userId,
    expires: new Date(Date.now() + 86400000),
  })

  return NextResponse.json({ sessionToken, userId, role: roleParam })
}
