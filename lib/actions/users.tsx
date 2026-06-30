'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/lib/drizzle/client'
import { usersTable, userRolesTable, rolesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { auth, isSuperUser } from '@/lib/auth'
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email('Invalid email').transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, 'Role is required'),
})

const updateUserSchema = z.object({
  email: z.string().email('Invalid email').transform((v) => v.trim().toLowerCase()),
  roleId: z.string().min(1, 'Role is required'),
})

const userIdSchema = z.string().uuid('Invalid user ID')

export type UserWithRole = {
  id: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
}

export async function getUsers() {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      roleId: userRolesTable.roleId,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(usersTable.id, userRolesTable.userId))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))

  return { success: true as const, users }
}

export async function createUser(data: z.infer<typeof createUserSchema>) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const parsed = createUserSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { email, roleId } = parsed.data

  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .then((rows) => rows[0])

  if (existingUser) {
    return { success: false as const, error: 'A user with this email already exists' }
  }

  const userId = crypto.randomUUID()

  await db.insert(usersTable).values({
    id: userId,
    email,
  })

  await db.insert(userRolesTable).values({
    userId,
    roleId,
  })

  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const { InvitationEmail } = await import('@/emails/invitation')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    await resend.emails.send({
      from: 'Alsia <onboarding@resend.dev>',
      to: email,
      subject: 'You\'ve been invited to Alsia',
      react: <InvitationEmail loginUrl={`${appUrl}/login`} />,
    })
  }

  revalidatePath('/dashboard/users')
  updateTag('permissions')
  return { success: true as const }
}

export async function updateUser(
  userId: string,
  data: z.infer<typeof updateUserSchema>,
) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const userIdResult = userIdSchema.safeParse(userId)
  if (!userIdResult.success) {
    return { success: false as const, error: 'Invalid user ID' }
  }

  const parsed = updateUserSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { email, roleId } = parsed.data

  const currentUserRole = await db
    .select({ roleName: rolesTable.name })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .then((rows) => rows[0])

  if (!currentUserRole) {
    return { success: false as const, error: 'User not found' }
  }

  const isChangingSelf = session.user.id === userId
  if (isChangingSelf && currentUserRole.roleName === 'super') {
    const newRole = await db
      .select({ name: rolesTable.name })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .then((rows) => rows[0])

    if (newRole?.name !== 'super') {
      return { success: false as const, error: 'You cannot demote yourself' }
    }
  }

  await db.update(usersTable).set({ email }).where(eq(usersTable.id, userId))
  await db
    .update(userRolesTable)
    .set({ roleId })
    .where(eq(userRolesTable.userId, userId))

  revalidatePath('/dashboard/users')
  updateTag('permissions')
  return { success: true as const }
}

export async function deleteUser(userId: string) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return { success: false as const, error: 'Forbidden' }
  }

  const userIdResult = userIdSchema.safeParse(userId)
  if (!userIdResult.success) {
    return { success: false as const, error: 'Invalid user ID' }
  }

  if (session.user.id === userId) {
    return { success: false as const, error: 'You cannot delete yourself' }
  }

  const superRole = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, 'super'))
    .then((rows) => rows[0])

  if (!superRole) {
    return { success: false as const, error: 'Super role not found' }
  }

  const targetRole = await db
    .select({ roleId: userRolesTable.roleId })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId))
    .then((rows) => rows[0])

  if (targetRole?.roleId === superRole.id) {
    const superCount = await db
      .select({ count: userRolesTable.userId })
      .from(userRolesTable)
      .where(eq(userRolesTable.roleId, superRole.id))
      .then((rows) => rows.length)

    if (superCount <= 1) {
      return {
        success: false as const,
        error: 'Cannot delete the last super user',
      }
    }
  }

  await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId))
  await db.delete(usersTable).where(eq(usersTable.id, userId))

  revalidatePath('/dashboard/users')
  updateTag('permissions')
  return { success: true as const }
}
